import Anthropic from '@anthropic-ai/sdk';
import { KV_KEYS, istDateStamp } from './config';
import type { Env, ScrapeCache } from './config';
import { EDITORIAL_SCHEMA } from './schema';
import type { Edition, Lore } from './schema';
import seedLore from './seed-lore.json';

// Byte-stable system prompt — keeps the Anthropic prompt cache warm across runs.
const SYSTEM_PROMPT = `You are the Editor-in-Chief of The Playbook, a satirical hyperlocal newspaper covering Bengaluru's flow-arts, juggling, and play community (hoops, poi, staff, levitation wands, fire props, circus toys). Tone: The Onion meets a neighbourhood WhatsApp-uncle newsletter, printed on a wheezing 1970s press. Deadpan, affectionate, never mean.

Hard rules:
- Real people who appear in Instagram captions become recurring HEROES of the paper, written about with absurd reverence. Never punch down, never mock individuals.
- Every article must trace to at least one real Instagram post (cite its permalink in sources) OR continue an established lore thread (then sources may be empty).
- Headlines are always slightly too dramatic for the event described. Provide 2-3 headline variants per article.
- Bengaluru specifics are the seasoning: Cubbon Park, HSR Layout, Indiranagar, Church Street, auto rickshaws, Silk Board traffic, sudden rain, filter coffee.
- Bylines come from the fictional staff in the lore. Keep their quirks consistent.
- Filler content is half the charm: classifieds (8+, absurd lost-and-found and for-sale items), prop horoscopes (6: Hoop, Poi, Staff, Juggling Clubs, Levitation Wand, Fire Props), letters to the editor with editor replies (2-3, Concerned Uncle of Jayanagar is a regular), house ads (2), breaking-news ticker (5+ one-liners), and 2-3 Laughter Index weather variants.
- Write 4-6 articles. Each has weight 1-10; the highest-weight article is the front-page lead — give it the strongest material.
- For images: only use imagePath values that appear verbatim in the scrape data. If an article has no matching image, use "" and leave caption/credit as "". Image credit is always something like "Playbook Staff Photographer (allegedly)".
- If the scrape data is stale or empty, that is itself news: write around it ("slow news day in the flow multiverse", "our correspondent's auto broke down"). Never invent fake Instagram posts.
- Maintain the lore: update runningGags usage counts, append ONE canonEvent summarizing this issue, evolve characters sparingly. Caps: canonEvents ≤ 30 (drop the oldest), runningGags ≤ 12 (retire the stalest), staff ≤ 8. Increment counters.issueNumber by exactly 1 for a new issue; keep it unchanged for a REPRINT.
- Output must satisfy the provided JSON schema exactly.`;

interface EditorialOptions {
  // 'nightly' = new issue (scrape first, bump issue number, update lore).
  // 'regen'   = reprint of today's paper (reuse scrape cache, keep issue number, do NOT persist lore).
  mode: 'nightly' | 'regen';
}

function freshness(scrape: ScrapeCache): string {
  if (scrape.provider === 'empty') return 'archive';
  const ageDays = Math.floor((Date.now() - Date.parse(scrape.scrapedAt)) / 86_400_000);
  return ageDays <= 1 ? 'fresh' : `stale-${ageDays}d`;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

async function recentHeadlines(env: Env): Promise<string[]> {
  const index = (await env.PLAYBOOK.get<string[]>(KV_KEYS.editionsIndex, 'json')) ?? [];
  const lines: string[] = [];
  for (const date of index.slice(-3)) {
    const edition = await env.PLAYBOOK.get<Edition>(KV_KEYS.edition(date), 'json');
    if (edition) {
      lines.push(`${date}: ${edition.articles.map((a) => a.headlines[0]).join(' | ')}`);
    }
  }
  return lines;
}

export async function runEditorial(env: Env, opts: EditorialOptions): Promise<Edition> {
  const date = istDateStamp();
  const lore = ((await env.PLAYBOOK.get<Lore>(KV_KEYS.lore, 'json')) ?? seedLore) as Lore;
  const scrape =
    (await env.PLAYBOOK.get<ScrapeCache>(KV_KEYS.scrapeCache, 'json')) ??
    ({ scrapedAt: '', provider: 'empty', accounts: {} } as ScrapeCache);

  // Trim captions so the prompt stays lean.
  const scrapeForPrompt = {
    scrapedAt: scrape.scrapedAt,
    provider: scrape.provider,
    accounts: Object.fromEntries(
      Object.entries(scrape.accounts).map(([k, a]) => [
        k,
        { ...a, bio: truncate(a.bio, 200), posts: a.posts.map((p) => ({ ...p, caption: truncate(p.caption, 500) })) },
      ]),
    ),
  };

  const userPrompt = [
    `Today is ${date}. ${opts.mode === 'regen' ? 'This is a REPRINT of today\'s issue — same issue number, but write a substantially fresh take: new angles, new headlines, new filler.' : 'Produce the next issue.'}`,
    `Scrape freshness: ${freshness(scrape)} (scrapedAt: ${scrape.scrapedAt || 'never'}).`,
    '',
    '## Current lore',
    JSON.stringify(lore),
    '',
    '## Recent editions (headlines only — do not repeat these jokes)',
    (await recentHeadlines(env)).join('\n') || '(none yet — this is an early issue)',
    '',
    '## Tonight\'s Instagram scrape',
    JSON.stringify(scrapeForPrompt),
  ].join('\n');

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const message = await client.messages
    .stream({
      model: 'claude-opus-4-8',
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: EDITORIAL_SCHEMA } },
      messages: [{ role: 'user', content: userPrompt }],
    })
    .finalMessage();

  if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
    throw new Error(`editorial board stopped: ${message.stop_reason}`);
  }
  const text = message.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('editorial board returned no text');
  const { edition, updatedLore } = JSON.parse(text.text) as { edition: Edition; updatedLore: Lore };

  // Stamp authoritative fields the model shouldn't control.
  edition.meta.date = date;
  edition.meta.scrapeFreshness = freshness(scrape);
  if (opts.mode === 'regen') {
    edition.meta.volume = lore.counters.volume;
    edition.meta.issue = lore.counters.issueNumber;
  } else {
    edition.meta.volume = updatedLore.counters.volume;
    edition.meta.issue = updatedLore.counters.issueNumber;
  }

  // Drop image references that don't exist in R2 (model hallucination guard).
  for (const article of edition.articles) {
    if (article.imagePath) {
      const key = article.imagePath.replace('/api/playbook/img/', '');
      const head = await env.IMAGES.head(key);
      if (!head) {
        article.imagePath = '';
        article.imageCaption = '';
        article.imageCredit = '';
      }
    }
  }

  // Persist. A failure above leaves yesterday's paper untouched.
  await env.PLAYBOOK.put(KV_KEYS.edition(date), JSON.stringify(edition));
  await env.PLAYBOOK.put(KV_KEYS.latest, JSON.stringify(edition));
  if (opts.mode === 'nightly') {
    // Hard backstop on lore growth (the prompt asks; we enforce).
    updatedLore.canonEvents = updatedLore.canonEvents.slice(-30);
    updatedLore.runningGags = updatedLore.runningGags.slice(0, 12);
    updatedLore.staff = updatedLore.staff.slice(0, 8);
    await env.PLAYBOOK.put(KV_KEYS.lore, JSON.stringify(updatedLore));

    const index = (await env.PLAYBOOK.get<string[]>(KV_KEYS.editionsIndex, 'json')) ?? [];
    if (!index.includes(date)) index.push(date);
    await env.PLAYBOOK.put(KV_KEYS.editionsIndex, JSON.stringify(index));
  }

  return edition;
}
