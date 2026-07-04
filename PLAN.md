# SiteWatch — Plan

Campsite availability watcher: Expo client + a Vercel-hosted scanner that pushes when a watched campground opens up. Open source (MIT). Original spec: `docs/KICKOFF.md`.

## Viability verdict (verified 2026-07-04)

Viable as specced.

| Dependency | Status | Notes |
|---|---|---|
| Recreation.gov availability endpoint | **Verified live** | Tested campground 232447 (Upper Pines, Yosemite) for Aug 2026; response shape matches the kickoff exactly: `{campsites: {[id]: {site, loop, availabilities: {dateISO: "Reserved"|"Available"...}}}}` |
| RIDB API v1 | Verified live | Returns 401 without key, as expected; free key required |
| Expo Push API | Live | Free, personal Expo account |

The availability endpoint is undocumented, so the kickoff's defensive posture (zod runtime validation, kill switch) is correct and stays.

## Adjustments to the kickoff

1. **Platform: Vercel Pro (`betz` org), not Cloudflare Workers.** Chris has Vercel Pro, which allows per-minute cron schedules, so the whole backend lives there: Hono served through the `hono/vercel` adapter as a Vercel Function, with the 5-minute scan declared in `vercel.json` crons and authenticated via the `CRON_SECRET` convention (Vercel sends `Authorization: Bearer $CRON_SECRET` to cron paths when that env var exists).
2. **Storage: Upstash Redis via the Vercel Marketplace** (Vercel's first-party KV was folded into the Marketplace). Watches, availability snapshots, and backoff state as Redis keys/sets through `@upstash/redis` (REST client, works in any runtime). Scan volume is roughly 288 cycles/day times a handful of commands per watched campground, comfortably inside Upstash's free tier. Storage sits behind an interface with an in-memory implementation for tests and local dev.
3. Everything else stands, especially the politeness stack from line one: one request per campground-month per cycle, 100-300ms jitter, honest User-Agent pointing at the repo, exponential backoff on 403/429, global kill-switch env var, scan interval as config.

## Deployment

- `server/` is the product: a Vercel project on the `betz` org (root directory `server/`), Node runtime, `vercel.json` cron `*/5 * * * *` on `/api/cron/scan`, Upstash Redis attached via Marketplace integration. Env vars: `RIDB_API_KEY`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SCAN_KILL_SWITCH`.
- Local dev runs the same Hono app under `@hono/node-server` (no Vercel CLI required); tests run against the in-memory storage.
- Landing page and/or Expo web export can join the same org later.

## Legal posture

Read-only polling of a public, unauthenticated endpoint, scoped to campgrounds with active watches, at low volume, with an honest User-Agent and a documented policy in `docs/TERMS.md`. No booking automation ever; deep-link to Recreation.gov for the actual reservation. This is the same surface long-standing open-source tools (camply) have used for years. The kill switch means we can stand down instantly if Recreation.gov ever objects.

## Build sequence

1. Prereqs: RIDB API key (sign in at ridb.recreation.gov with a Recreation.gov account, generate under profile), Vercel CLI linked to `betz`, Upstash Redis Marketplace integration, Expo account.
2. Server first: availability client + zod schema, tested against a fixture JSON of the real response; then the diff/notify job; then watches CRUD (POST/GET/DELETE). Working under the local Node dev server with tests green before any mobile code.
3. Cron wiring: per-campground scan grouping, Redis snapshot diff (write only on change), Expo push with deep link to `recreation.gov/camping/campsites/{siteId}`, auto-expire watches past endDate.
4. Expo app: Explore tab (RIDB facility search, state filter, map via react-native-maps), campground detail (month grid, date-range picker, "Watch this"), Watches tab (list, swipe-delete).
5. `docs/TERMS.md`, README with RIDB key registration steps, architecture diagram, MIT license.

Estimate: the server is a weekend; the app adds another.

## Risks

- The endpoint is undocumented and could change shape or gain auth without notice; zod validation plus the kill switch is the mitigation, and RIDB metadata is unaffected either way.
- react-native-maps needs a config plugin and (on Android) a Google Maps API key; the Expo web export won't have map parity. Acceptable for MVP.
