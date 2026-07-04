# SiteWatch — Plan

Campsite availability watcher: Expo client + Cloudflare Workers scanner that pushes when a watched campground opens up. Open source (MIT). Original spec: `docs/KICKOFF.md`.

## Viability verdict (verified 2026-07-04)

Viable as specced.

| Dependency | Status | Notes |
|---|---|---|
| Recreation.gov availability endpoint | **Verified live** | Tested campground 232447 (Upper Pines, Yosemite) for Aug 2026; response shape matches the kickoff exactly: `{campsites: {[id]: {site, loop, availabilities: {dateISO: "Reserved"|"Available"...}}}}` |
| RIDB API v1 | Verified live | Returns 401 without key, as expected; free key required |
| Expo Push API | Live | Free, personal Expo account |

The availability endpoint is undocumented, so the kickoff's defensive posture (zod runtime validation, kill switch) is correct and stays.

## Adjustments to the kickoff

1. **Storage: use D1, not KV, for availability snapshots.** KV free tier allows only 1,000 writes/day. A 5-minute cron is 288 cycles/day; naively persisting a snapshot per watched campground per cycle exceeds the cap with just four campgrounds. Either diff in memory and write only when state changes, or (recommended) use D1, whose free tier allows 100,000 writes/day. Watches themselves can stay in KV or live in D1 alongside; simplest is D1 for everything.
2. Everything else stands, especially the politeness stack from line one: one request per campground-month per cycle, 100-300ms jitter, honest User-Agent pointing at the repo, exponential backoff on 403/429, global kill-switch env var, scan interval as config.

## Deployment

- `server/` is the product and it must run on Cloudflare Workers (free tier), personal Cloudflare account. The 5-minute cron rules out Vercel: Hobby plan crons are limited to once per day; per-minute schedules require Pro. Cloudflare cron triggers are free at any schedule.
- Vercel `betz` org: landing page and/or Expo web export, when wanted. Not needed for MVP.

## Legal posture

Read-only polling of a public, unauthenticated endpoint, scoped to campgrounds with active watches, at low volume, with an honest User-Agent and a documented policy in `docs/TERMS.md`. No booking automation ever; deep-link to Recreation.gov for the actual reservation. This is the same surface long-standing open-source tools (camply) have used for years. The kill switch means we can stand down instantly if Recreation.gov ever objects.

## Build sequence

1. Prereqs: RIDB API key (sign in at ridb.recreation.gov with a Recreation.gov account, generate under profile), Cloudflare account + `wrangler login`, Expo account.
2. Server first: availability client + zod schema, tested against a fixture JSON of the real response; then the diff/notify job; then watches CRUD (POST/GET/DELETE). Working under `wrangler dev` before any mobile code.
3. Cron wiring: per-campground scan grouping, D1 snapshot diff, Expo push with deep link to `recreation.gov/camping/campsites/{siteId}`, auto-expire watches past endDate.
4. Expo app: Explore tab (RIDB facility search, state filter, map via react-native-maps), campground detail (month grid, date-range picker, "Watch this"), Watches tab (list, swipe-delete).
5. `docs/TERMS.md`, README with RIDB key registration steps, architecture diagram, MIT license.

Estimate: the server is a weekend; the app adds another.

## Risks

- The endpoint is undocumented and could change shape or gain auth without notice; zod validation plus the kill switch is the mitigation, and RIDB metadata is unaffected either way.
- react-native-maps needs a config plugin and (on Android) a Google Maps API key; the Expo web export won't have map parity. Acceptable for MVP.
