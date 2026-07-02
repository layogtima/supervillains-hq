export const ACCOUNTS = [
  'supervillains.wtf',
  'flowshaala',
  'mufasamagique',
  'captain_technofire',
  'hoopwithsupriya',
] as const;

export const POSTS_PER_ACCOUNT = 3;

// Global cooldown between public regenerations (seconds).
export const REGEN_COOLDOWN_SECONDS = 600;

// Keep post images for this many most-recent editions.
export const IMAGE_RETENTION_EDITIONS = 14;

export const KV_KEYS = {
  latest: 'latest',
  lore: 'lore',
  scrapeCache: 'scrape:cache',
  editionsIndex: 'editions:index',
  regenLock: 'regen:lock',
  edition: (date: string) => `edition:${date}`,
};

export interface Env {
  PLAYBOOK: KVNamespace;
  IMAGES: R2Bucket;
  ANTHROPIC_API_KEY: string;
  APIFY_TOKEN?: string;
  RUN_KEY?: string;
}

export interface ScrapedPost {
  shortcode: string;
  permalink: string;
  takenAt: string; // ISO 8601
  caption: string;
  isVideo: boolean;
  // Repo-served path (/api/playbook/img/<key>) once localized to R2, else null.
  imagePath: string | null;
  likes: number;
  comments: number;
}

export interface ScrapedAccount {
  username: string;
  fullName: string;
  bio: string;
  followers: number;
  posts: ScrapedPost[];
}

export interface ScrapeCache {
  scrapedAt: string;
  provider: 'apify' | 'anonymous' | 'cache' | 'empty';
  accounts: Record<string, ScrapedAccount>;
}

// IST (UTC+5:30) date for "today's paper" regardless of where the Worker runs.
export function istDateStamp(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}
