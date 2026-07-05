import type { MonthAvailability, SiteRow } from "./types";

interface RawCampsite {
  campsite_id: string;
  site: string;
  loop?: string;
  campsite_type?: string;
  availabilities: Record<string, string>;
}

/**
 * Live month grid straight from Recreation.gov, one request per user-initiated
 * view. Continuous monitoring stays server-side; see docs/TERMS.md.
 */
export async function fetchMonthAvailability(campgroundId: string, month: string): Promise<MonthAvailability> {
  const startDate = encodeURIComponent(`${month}T00:00:00.000Z`);
  const url = `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${startDate}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Availability request failed (HTTP ${res.status})`);
  const body = (await res.json()) as { campsites?: Record<string, RawCampsite> };

  const dates = new Set<string>();
  const sites: SiteRow[] = [];
  for (const raw of Object.values(body.campsites ?? {})) {
    if (!raw?.campsite_id || !raw.availabilities) continue;
    const days: Record<string, string> = {};
    for (const [date, status] of Object.entries(raw.availabilities)) {
      const day = date.slice(0, 10);
      days[day] = status;
      dates.add(day);
    }
    sites.push({
      campsiteId: raw.campsite_id,
      site: raw.site ?? raw.campsite_id,
      loop: raw.loop ?? "",
      type: raw.campsite_type ?? "",
      days,
    });
  }
  sites.sort((a, b) => a.site.localeCompare(b.site, undefined, { numeric: true }));
  return { dates: [...dates].sort(), sites };
}
