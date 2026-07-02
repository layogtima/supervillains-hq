import { ACCOUNTS, KV_KEYS, POSTS_PER_ACCOUNT, istDateStamp } from './config';
import type { Env, ScrapeCache, ScrapedAccount, ScrapedPost } from './config';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface RawPost extends Omit<ScrapedPost, 'imagePath'> {
  imageUrl: string | null;
}
type RawAccount = Omit<ScrapedAccount, 'posts'> & { posts: RawPost[] };

async function apifyProvider(token: string): Promise<Record<string, RawAccount>> {
  const res = await fetch(
    'https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=' +
      encodeURIComponent(token),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usernames: [...ACCOUNTS] }),
      signal: AbortSignal.timeout(180_000),
    },
  );
  if (!res.ok) throw new Error(`apify ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const items = (await res.json()) as any[];
  const accounts: Record<string, RawAccount> = {};
  for (const item of items) {
    if (!item?.username) continue;
    accounts[item.username] = {
      username: item.username,
      fullName: item.fullName ?? '',
      bio: item.biography ?? '',
      followers: item.followersCount ?? 0,
      posts: (item.latestPosts ?? []).slice(0, POSTS_PER_ACCOUNT).map((p: any) => ({
        shortcode: p.shortCode ?? p.id ?? '',
        permalink: p.url ?? `https://www.instagram.com/p/${p.shortCode}/`,
        takenAt: p.timestamp ?? '',
        caption: p.caption ?? '',
        isVideo: p.type === 'Video',
        imageUrl: p.displayUrl ?? null,
        likes: p.likesCount ?? 0,
        comments: p.commentsCount ?? 0,
      })),
    };
  }
  if (Object.keys(accounts).length === 0) throw new Error('apify returned no profiles');
  return accounts;
}

async function anonymousProvider(): Promise<Record<string, RawAccount>> {
  const accounts: Record<string, RawAccount> = {};
  for (const username of ACCOUNTS) {
    try {
      const res = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        {
          headers: {
            'user-agent': BROWSER_UA,
            'x-ig-app-id': '936619743392459',
            accept: 'application/json',
          },
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as any;
      const user = data?.data?.user;
      if (!user) continue;
      const edges = user.edge_owner_to_timeline_media?.edges ?? [];
      accounts[username] = {
        username,
        fullName: user.full_name ?? '',
        bio: user.biography ?? '',
        followers: user.edge_followed_by?.count ?? 0,
        posts: edges.slice(0, POSTS_PER_ACCOUNT).map(({ node }: any) => ({
          shortcode: node.shortcode,
          permalink: `https://www.instagram.com/p/${node.shortcode}/`,
          takenAt: node.taken_at_timestamp
            ? new Date(node.taken_at_timestamp * 1000).toISOString()
            : '',
          caption: node.edge_media_to_caption?.edges?.[0]?.node?.text ?? '',
          isVideo: !!node.is_video,
          imageUrl: node.display_url ?? null,
          likes: node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? 0,
          comments: node.edge_media_to_comment?.count ?? 0,
        })),
      };
    } catch {
      // one blocked account shouldn't sink the rest
    }
    // jitter so we don't look like a burst
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
  }
  if (Object.keys(accounts).length === 0) throw new Error('anonymous scrape got nothing');
  return accounts;
}

// IG CDN URLs are signed and expire within days — copy images into R2 and
// reference them by our own path forever after.
async function localizeImages(
  env: Env,
  raw: Record<string, RawAccount>,
  dateStamp: string,
): Promise<Record<string, ScrapedAccount>> {
  const out: Record<string, ScrapedAccount> = {};
  for (const [username, account] of Object.entries(raw)) {
    const posts: ScrapedPost[] = [];
    for (const post of account.posts) {
      let imagePath: string | null = null;
      if (post.imageUrl) {
        try {
          const res = await fetch(post.imageUrl, {
            headers: { 'user-agent': BROWSER_UA },
            signal: AbortSignal.timeout(20_000),
          });
          if (res.ok && res.body) {
            const key = `${dateStamp}/${post.shortcode}.jpg`;
            await env.IMAGES.put(key, res.body, {
              httpMetadata: { contentType: res.headers.get('content-type') ?? 'image/jpeg' },
            });
            imagePath = `/api/playbook/img/${key}`;
          }
        } catch {
          // no image is fine; the paper survives
        }
      }
      const { imageUrl: _drop, ...rest } = post;
      posts.push({ ...rest, imagePath });
    }
    out[username] = { ...account, posts };
  }
  return out;
}

export async function runScrape(env: Env): Promise<ScrapeCache> {
  const dateStamp = istDateStamp();
  let raw: Record<string, RawAccount> | null = null;
  let provider: ScrapeCache['provider'] = 'empty';

  if (env.APIFY_TOKEN) {
    try {
      raw = await apifyProvider(env.APIFY_TOKEN);
      provider = 'apify';
    } catch (e) {
      console.warn('apify provider failed:', e);
    }
  }
  if (!raw) {
    try {
      raw = await anonymousProvider();
      provider = 'anonymous';
    } catch (e) {
      console.warn('anonymous provider failed:', e);
    }
  }

  if (raw) {
    const cache: ScrapeCache = {
      scrapedAt: new Date().toISOString(),
      provider,
      accounts: await localizeImages(env, raw, dateStamp),
    };
    await env.PLAYBOOK.put(KV_KEYS.scrapeCache, JSON.stringify(cache));
    return cache;
  }

  // Fall back to the last successful scrape — the paper always publishes.
  const cached = await env.PLAYBOOK.get<ScrapeCache>(KV_KEYS.scrapeCache, 'json');
  if (cached) return { ...cached, provider: 'cache' };
  return { scrapedAt: new Date().toISOString(), provider: 'empty', accounts: {} };
}
