import { z } from "zod";

// Response shape of the undocumented Recreation.gov availability endpoint:
// GET https://www.recreation.gov/api/camps/availability/campground/{id}/month?start_date=YYYY-MM-01T00:00:00.000Z
// Unknown fields are stripped, statuses are open-ended strings ("Available",
// "Reserved", "Closed", "Not Reservable", ...) so new values never break parsing.
const campsiteSchema = z.object({
  campsite_id: z.string(),
  site: z.string(),
  loop: z.string().optional(),
  campsite_type: z.string().optional(),
  availabilities: z.record(z.string(), z.string()),
});

const availabilityMonthSchema = z.object({
  campsites: z.record(z.string(), campsiteSchema),
});

export type AvailabilityMonth = z.infer<typeof availabilityMonthSchema>;

/** Normalized per-campground-month state we persist and diff. */
export interface Snapshot {
  fetchedAt: string;
  campsites: Record<
    string,
    {
      site: string;
      loop?: string;
      campsiteType?: string;
      /** date (YYYY-MM-DD) -> status string */
      availabilities: Record<string, string>;
    }
  >;
}

export class RateLimitError extends Error {
  constructor(public status: number) {
    super(`Recreation.gov responded ${status}`);
    this.name = "RateLimitError";
  }
}

export function parseAvailability(raw: unknown): AvailabilityMonth {
  return availabilityMonthSchema.parse(raw);
}

export function toSnapshot(month: AvailabilityMonth, fetchedAt: string): Snapshot {
  const campsites: Snapshot["campsites"] = {};
  for (const [id, c] of Object.entries(month.campsites)) {
    const availabilities: Record<string, string> = {};
    for (const [date, status] of Object.entries(c.availabilities)) {
      availabilities[date.slice(0, 10)] = status;
    }
    campsites[id] = {
      site: c.site,
      loop: c.loop,
      campsiteType: c.campsite_type,
      availabilities,
    };
  }
  return { fetchedAt, campsites };
}

export const USER_AGENT = "SiteWatch/0.1 (+https://github.com/cbetz/sitewatch)";

export type FetchAvailability = (
  campgroundId: string,
  /** first of month, YYYY-MM-01 */
  month: string,
) => Promise<AvailabilityMonth>;

/**
 * Live client. One call fetches one campground-month; the scan job is
 * responsible for jitter between calls and for backoff on RateLimitError.
 */
export function createAvailabilityClient(fetchImpl: typeof fetch = fetch): FetchAvailability {
  return async (campgroundId, month) => {
    const startDate = encodeURIComponent(`${month}T00:00:00.000Z`);
    const url = `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${startDate}`;
    const res = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 403 || res.status === 429) throw new RateLimitError(res.status);
    if (!res.ok) throw new Error(`Availability fetch failed: ${res.status} for ${campgroundId}/${month}`);
    return parseAvailability(await res.json());
  };
}
