# Taiwan Monthly

An English tracker of every Taiwan-listed (TWSE) and OTC (TPEx) company's monthly
revenue, built from official open data. It has a free public site, plus a paid Pro
tier with same-day email alerts and full-history downloads.

**Owner setup:** see [SETUP-GUIDE.md](SETUP-GUIDE.md).

## How it works

| Part | Where | What it does |
|---|---|---|
| `pipeline/` | GitHub Actions | Fetches the TWSE/TPEx OpenAPI snapshots, **validates** them (our YoY must match the published YoY, units sanity, no future dates), merges them into `data/` (never deleting; corrections kept as `revisions`), and queues alerts. |
| `data/` | git | One JSON file per month, one company per line. The git history is the audit trail. |
| `site/` | build step | Static site with build-time SVG charts (desktop and phone versions), around 2,000 pages. |
| `share/` | build step | Monthly PNG share images and a caption, also used as the og:image. |
| `server/` + `functions/` | Cloudflare Pages Functions | `/api/*`: email-code sign-in, watchlists, Lemon Squeezy webhook, alert emails (Resend), gated downloads. D1 database (`schema.sql`) and KV storage. |

Fail-closed policy: if a source fails validation, that source's update is not
published and the run fails, so GitHub emails the owner. Brief outages only
become errors after 6 failed runs in a row.

## Commands

```bash
npm install
npm test                      # pipeline + server tests
npm run update                # fetch official data into data/
npm run backfill              # one-time: load history from MOPS
npm run build                 # build dist/ from data/
npm run build:sample          # preview with INVENTED sample data (bannered, noindex)
npm run share                 # share images into dist/share/
npm run dev                   # local Cloudflare runtime with the API (emails go to the outbox table)
```

For `npm run dev`, create `.dev.vars` with `EMAIL_DRY_RUN=true`, `NOTIFY_SECRET=...` and
`LEMON_SQUEEZY_WEBHOOK_SECRET=...`.

## Data and licence

The source data comes from the Taiwan Stock Exchange and the Taipei Exchange under
the Open Government Data License, version 1.0, which requires attribution. Amounts
are thousand NT$, as filed. See `/methodology/` and `/sources/` on the site.
