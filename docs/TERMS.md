# Scanning policy

SiteWatch reads two data sources:

1. **RIDB API** (`ridb.recreation.gov/api/v1`) — the documented, sanctioned API for facility and campsite metadata, accessed with a registered key. The server proxies facility search so the key never ships in the client.
2. **Recreation.gov availability endpoint** (`/api/camps/availability/campground/{id}/month`) — public and unauthenticated but undocumented. SiteWatch treats it as a guest, not an entitlement.

## Rules the scanner enforces in code

- Scan only campgrounds that have at least one active watch. Never crawl the catalog.
- At most one request per campground-month per scan cycle; cycles run every 5 minutes.
- 100-300ms of jitter between consecutive requests.
- An honest User-Agent (`SiteWatch/0.1 (+https://github.com/cbetz/sitewatch)`) so Recreation.gov operators can identify and contact us.
- Exponential backoff per campground on HTTP 403/429 (15 minutes doubling out to a 6 hour cap).
- A global kill switch (`SCAN_KILL_SWITCH=1`) that halts all scanning immediately without a deploy.
- Watches expire automatically after their date range passes and are pruned.

## What SiteWatch will never do

- Automate, assist, or accelerate the booking flow. When a site opens, the notification deep-links to Recreation.gov and the human takes it from there.
- Resell, redistribute, or bulk-archive availability data.
- Evade rate limiting, rotate identities, or misrepresent its traffic.

If Recreation.gov ever objects to this traffic, the kill switch goes on and this document gets updated with whatever we learn.
