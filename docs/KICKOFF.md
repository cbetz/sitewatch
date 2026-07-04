# Campsite Scanner — Repo Scaffold + Claude Code Kickoff

## Repo: `sitewatch` (MIT license)

```
sitewatch/
├── app/                        # Expo app
│   ├── (tabs)/
│   │   ├── explore.tsx         # Campground search + map
│   │   ├── watches.tsx         # Active availability watches
│   │   └── settings.tsx
│   └── campground/[id].tsx     # Availability calendar + "watch" CTA
├── src/
│   ├── api/
│   │   ├── ridb.ts             # RIDB API client (facilities, campsites)
│   │   └── types.ts
│   └── lib/storage.ts
├── server/                     # The actual product lives here
│   ├── src/
│   │   ├── index.ts            # Hono API: /watches CRUD
│   │   ├── jobs/scan.ts        # Cron: check availability for active watches
│   │   ├── availability.ts     # Rec.gov availability endpoint client + parser
│   │   └── push.ts
│   ├── wrangler.toml           # Workers + KV + cron (*/5)
│   └── .dev.vars.example       # RIDB_API_KEY=
├── docs/
│   ├── TERMS.md                # RIDB terms notes + polite-scanning policy
│   └── AVAILABILITY_API.md     # Undocumented endpoint shape, month param format
└── README.md
```

## Stack decisions
- **RIDB API** (`https://ridb.recreation.gov/api/v1`) — free key, documented, covers facilities/campsites/metadata. This is the sanctioned surface.
- **Availability** comes from `https://www.recreation.gov/api/camps/availability/campground/{id}/month?start_date=...` — undocumented but stable and public. Treat it carefully:
  - Scan **only campgrounds with active watches**, not the whole catalog
  - One request per campground-month per cycle, 5-min cron, jittered, honest User-Agent pointing at the repo
  - Document this policy in `docs/TERMS.md` and make the scan interval a config, not a race
- **Booking stays on Recreation.gov** — deep link to the campsite page. No automation of the booking flow, ever; that's the line the gray-zone paid apps cross.
- **Server-first architecture**: phones can't background-poll reliably. Watches live server-side (KV), phone is a thin client + push receiver.

## MVP checklist
- [ ] Explore: search facilities by name/state via RIDB, map view (react-native-maps), campground cards
- [ ] Campground detail: month availability grid (site × date), pulled live
- [ ] Create watch: campground + date range + optional site-type filter (tent/RV/group)
- [ ] Server cron: scan watched campgrounds, diff against last-seen state, push "Site A23 opened for Jul 10–12" with deep link
- [ ] Watch management: pause, delete, auto-expire after date range passes
- [ ] Rate-limit self-discipline: global scan budget, per-campground cooldown

## Claude Code kickoff prompt

```
Bootstrap an open-source campsite availability watcher called SiteWatch:
Expo (React Native, TypeScript) client + Cloudflare Workers backend.

Data sources:
- RIDB API v1 (https://ridb.recreation.gov/api/v1, apikey header, free
  registration) for facility search and campsite metadata
- Recreation.gov availability endpoint:
  GET https://www.recreation.gov/api/camps/availability/campground/{campgroundId}/month?start_date=YYYY-MM-01T00:00:00.000Z
  Returns {campsites: {[siteId]: {availabilities: {[dateISO]: "Available"|"Reserved"|...}, site: "A23", campsite_type}}}.
  Undocumented — build the client defensively with runtime validation (zod).

Build order:
1. server/ first — it's the core product. Hono on Cloudflare Workers:
   - POST /watches {pushToken, campgroundId, startDate, endDate, siteTypes?}
   - GET /watches?pushToken=..., DELETE /watches/:id
   - KV storage keyed by campgroundId for efficient scan grouping
   - Cron every 5 min: for each campground with active watches, fetch the
     relevant month(s), diff availability against KV snapshot, and for any
     newly-Available date inside a watch window, send Expo Push with a deep
     link to https://www.recreation.gov/camping/campsites/{siteId}
   - Politeness built in: max 1 availability request per campground per cycle,
     100-300ms jitter between requests, User-Agent "SiteWatch/0.1
     (+github.com/OWNER/sitewatch)", exponential backoff on 403/429, and a
     global kill-switch env var.
2. Expo app with tabs (Explore, Watches, Settings):
   - Explore: RIDB facility search (FacilityTypeDescription=Campground),
     state filter, map view with markers
   - Campground screen: month grid of availability (dates × sites, green/gray
     cells), date-range picker → "Watch this" button → POST /watches
   - Watches tab: list from server, swipe to delete, expired watches auto-pruned
3. Auto-expire watches after endDate server-side.
4. docs/TERMS.md documenting the scanning policy and why booking automation is
   out of scope. README with setup (RIDB key registration steps), architecture
   diagram, MIT license.

Start with the server: availability client + zod schema + the diff/notify job,
with a test using a fixture JSON response. Show me that working via
`wrangler dev` before touching the mobile app.
```
