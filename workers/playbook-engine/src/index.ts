import { IMAGE_RETENTION_EDITIONS, KV_KEYS, REGEN_COOLDOWN_SECONDS } from './config';
import type { Env } from './config';
import { runScrape } from './scrape';
import { runEditorial } from './editorial';

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      ...init.headers,
    },
  });
}

async function nightly(env: Env): Promise<void> {
  await runScrape(env); // self-degrading: falls back to cache, never throws the run
  await runEditorial(env, { mode: 'nightly' });
  await pruneImages(env);
}

// Keep image folders only for the most recent editions.
async function pruneImages(env: Env): Promise<void> {
  const index = (await env.PLAYBOOK.get<string[]>(KV_KEYS.editionsIndex, 'json')) ?? [];
  const keep = new Set(index.slice(-IMAGE_RETENTION_EDITIONS));
  let cursor: string | undefined;
  do {
    const listing = await env.IMAGES.list({ cursor });
    const stale = listing.objects.filter((o) => !keep.has(o.key.split('/')[0]));
    if (stale.length) await env.IMAGES.delete(stale.map((o) => o.key));
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(nightly(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type, x-playbook-key',
        },
      });
    }

    if (request.method === 'GET' && path === '/api/playbook/latest') {
      const latest = await env.PLAYBOOK.get(KV_KEYS.latest);
      if (!latest) return json({ error: 'presses_jammed' }, { status: 404 });
      return new Response(latest, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=60',
        },
      });
    }

    if (request.method === 'GET' && path === '/api/playbook/editions') {
      const index = (await env.PLAYBOOK.get<string[]>(KV_KEYS.editionsIndex, 'json')) ?? [];
      return json({ editions: index });
    }

    const editionMatch = path.match(/^\/api\/playbook\/editions\/(\d{4}-\d{2}-\d{2})$/);
    if (request.method === 'GET' && editionMatch) {
      const edition = await env.PLAYBOOK.get(KV_KEYS.edition(editionMatch[1]));
      if (!edition) return json({ error: 'not_found' }, { status: 404 });
      return new Response(edition, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    if (request.method === 'GET' && path.startsWith('/api/playbook/img/')) {
      const key = decodeURIComponent(path.slice('/api/playbook/img/'.length));
      const object = await env.IMAGES.get(key);
      if (!object) return new Response('not found', { status: 404 });
      return new Response(object.body, {
        headers: {
          'content-type': object.httpMetadata?.contentType ?? 'image/jpeg',
          'cache-control': 'public, max-age=31536000, immutable',
          'access-control-allow-origin': '*',
        },
      });
    }

    // Public regen: truly re-runs the editorial board on today's scrape,
    // behind a global cooldown so a curious crowd can't drain the API budget.
    if (request.method === 'POST' && path === '/api/playbook/regen') {
      const lock = await env.PLAYBOOK.get(KV_KEYS.regenLock);
      if (lock) {
        return json(
          { error: 'cooldown', retryAfterSeconds: REGEN_COOLDOWN_SECONDS },
          { status: 429, headers: { 'retry-after': String(REGEN_COOLDOWN_SECONDS) } },
        );
      }
      await env.PLAYBOOK.put(KV_KEYS.regenLock, new Date().toISOString(), {
        expirationTtl: REGEN_COOLDOWN_SECONDS,
      });
      try {
        const edition = await runEditorial(env, { mode: 'regen' });
        return json(edition);
      } catch (e) {
        await env.PLAYBOOK.delete(KV_KEYS.regenLock);
        console.error('regen failed:', e);
        return json({ error: 'presses_jammed' }, { status: 500 });
      }
    }

    // Manual full pipeline (scrape + new issue) — guarded by the RUN_KEY secret.
    // Used for the first edition and ad-hoc reruns.
    if (request.method === 'POST' && path === '/api/playbook/run') {
      if (!env.RUN_KEY || request.headers.get('x-playbook-key') !== env.RUN_KEY) {
        return json({ error: 'not_found' }, { status: 404 });
      }
      const step = url.searchParams.get('step'); // optional: "scrape" | "editorial"
      if (step === 'scrape') {
        const cache = await runScrape(env);
        return json({ provider: cache.provider, accounts: Object.keys(cache.accounts) });
      }
      if (step === 'editorial') {
        return json(await runEditorial(env, { mode: 'nightly' }));
      }
      await nightly(env);
      const latest = await env.PLAYBOOK.get(KV_KEYS.latest);
      return new Response(latest, {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return json({ error: 'not_found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
