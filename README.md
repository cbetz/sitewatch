# SiteWatch

Watch Recreation.gov campgrounds for cancellations and openings. When a site in your date window becomes available, you get a push notification with a deep link to book it on Recreation.gov.

Open source (MIT). Expo (React Native) client + a small Vercel-hosted scanner. Booking always happens on Recreation.gov; see [docs/TERMS.md](docs/TERMS.md) for the polite-scanning policy this project is built around.

## Status

Server MVP live: availability client, snapshot diffing, watch CRUD, 5-minute scan cron, Expo push. Expo app working end to end: campground search, live availability grid, watch create/delete. See [PLAN.md](PLAN.md).

## App

The Expo app lives at the repo root (`src/app` is the expo-router tree):

```
npm install
npx expo start
```

Explore searches Recreation.gov campgrounds (through the server's RIDB proxy), the campground screen shows a live month grid (tap a day for the start, a later day for the end), and Watch registers the range with the server. Real push delivery needs a development build with an EAS projectId; in Expo Go the app falls back to a local token so everything except delivery still works.

## Server

```
cd server
npm install
npm test
npm run dev   # http://localhost:8787/api/health
```

Without Upstash credentials the server runs on in-memory storage, which is fine for development. Copy `server/.env.example` to `server/.env` to configure.

### API

- `POST /api/watches` `{pushToken, campgroundId, campgroundName?, startDate, endDate, siteTypes?}`
- `GET /api/watches?pushToken=...`
- `DELETE /api/watches/:id?pushToken=...`
- `GET /api/facilities?query=...&state=...` — RIDB search proxy (needs `RIDB_API_KEY`)
- `GET /api/cron/scan` — the scan job; protected by `CRON_SECRET` in production

### Deploy (Vercel)

The server deploys as a Vercel project with root directory `server/`. `vercel.json` declares the 5-minute cron on `/api/cron/scan`. Required setup:

1. Provision Upstash Redis through the Vercel Marketplace (adds `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
2. Set `CRON_SECRET` and `RIDB_API_KEY` env vars.
3. `vercel deploy` from `server/`, or connect the repo.

## License

MIT
