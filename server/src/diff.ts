import type { Snapshot } from "./availability.js";

export interface OpenedSlot {
  campsiteId: string;
  site: string;
  campsiteType?: string;
  /** YYYY-MM-DD */
  date: string;
}

/**
 * Slots that transitioned from a known non-Available status to Available.
 * Sites or dates absent from the previous snapshot are ignored: without a
 * prior observation there is no transition, and treating first sight as an
 * opening would spam every watcher on month rollover.
 */
export function diffSnapshots(prev: Snapshot, next: Snapshot): OpenedSlot[] {
  const opened: OpenedSlot[] = [];
  for (const [campsiteId, nextSite] of Object.entries(next.campsites)) {
    const prevSite = prev.campsites[campsiteId];
    if (!prevSite) continue;
    for (const [date, status] of Object.entries(nextSite.availabilities)) {
      if (status !== "Available") continue;
      const prevStatus = prevSite.availabilities[date];
      if (prevStatus !== undefined && prevStatus !== "Available") {
        opened.push({ campsiteId, site: nextSite.site, campsiteType: nextSite.campsiteType, date });
      }
    }
  }
  return opened.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.site.localeCompare(b.site)));
}

/** True when the availability content differs (fetchedAt excluded), so unchanged snapshots skip the storage write. */
export function snapshotChanged(prev: Snapshot | null, next: Snapshot): boolean {
  if (!prev) return true;
  return JSON.stringify(prev.campsites) !== JSON.stringify(next.campsites);
}
