# SiteWatch

Watch Recreation.gov campgrounds for cancellations and openings. When a site in your date window becomes available, you get a push notification with a deep link to book it on Recreation.gov.

Open source (MIT). Expo (React Native) client + a small Vercel-hosted scanner. Booking always happens on Recreation.gov; see [docs/TERMS.md](docs/TERMS.md) for the polite-scanning policy this project is built around.

## Status

Server MVP working: availability client, snapshot diffing, watch CRUD, 5-minute scan cron, Expo push. Mobile app not started yet. See [PLAN.md](PLAN.md).

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
