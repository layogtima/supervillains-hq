# The Playbook engine

Nightly-generated satirical newspaper for supervillains.wtf/playbook.

## How it works

- **Cron (03:00 IST)**: scrape Instagram (Apify → anonymous endpoint → last cached scrape) →
  copy post images to R2 → editorial board (Claude, `claude-opus-4-8`, structured output) writes
  the edition + updates the persistent lore → stored in KV. The paper always publishes; if
  scraping fails it writes around stale data. If the API call fails, yesterday's paper stays up.
- **API**: `GET /api/playbook/latest`, `GET /api/playbook/editions[/:date]`,
  `GET /api/playbook/img/<key>` (R2), `POST /api/playbook/regen` (real regeneration, 10-min
  global cooldown → 429), `POST /api/playbook/run` (full pipeline, needs `x-playbook-key`).
- **Lore** (`seed-lore.json` → KV `lore`): staff reporters, The Badger, running gags, canon
  events. Edit the KV value anytime to steer the paper's voice.

## Local dev

```sh
cp workers/playbook-engine/.dev.vars.example workers/playbook-engine/.dev.vars  # add real keys
npm run engine:dev        # engine on http://localhost:8799
npm run dev               # site on :4321+, proxies /api/playbook/* to :8799
# generate an edition (scrape + editorial):
curl -X POST "http://localhost:8799/api/playbook/run" -H "x-playbook-key: <RUN_KEY>"
```

Local KV/R2 state lives under `workers/playbook-engine/.wrangler/` (gitignored). A fixture
edition is in `fixtures/` — seed it with:
`npx wrangler kv key put latest --path fixtures/edition-2026-07-02.json --binding PLAYBOOK --local`
(run from `workers/playbook-engine/`).

## Deploy (one-time setup)

```sh
npx wrangler kv namespace create PLAYBOOK      # put the id into wrangler.jsonc
npx wrangler r2 bucket create playbook-images
npx wrangler secret put ANTHROPIC_API_KEY --config workers/playbook-engine/wrangler.jsonc
npx wrangler secret put APIFY_TOKEN --config workers/playbook-engine/wrangler.jsonc   # recommended
npx wrangler secret put RUN_KEY --config workers/playbook-engine/wrangler.jsonc
npm run engine:deploy
```

Then uncomment the `routes` block in `wrangler.jsonc` once supervillains.wtf is on the
Cloudflare account, and connect the repo to Cloudflare Workers Builds for the Astro site
(build command `npm run build`, output `dist/`).

Costs: editorial run ≈ $0.18/night on `claude-opus-4-8`; Apify's free credit covers the nightly
profile scrape; Workers Paid plan (~$5/mo) recommended for the cron's headroom.
