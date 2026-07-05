import { z } from "zod";
import type { OpenedSlot } from "./diff.js";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const watchCreateSchema = z.object({
  pushToken: z.string().min(1).max(200),
  campgroundId: z.string().regex(/^\d+$/, "expected a numeric Recreation.gov campground id"),
  campgroundName: z.string().min(1).max(200).optional(),
  startDate: dateString,
  endDate: dateString,
  /** Keyword filters matched case-insensitively against campsite_type, e.g. ["TENT"], ["RV", "STANDARD"]. */
  siteTypes: z.array(z.string().min(1).max(60)).max(10).optional(),
});

export type WatchCreate = z.infer<typeof watchCreateSchema>;

export interface Watch extends WatchCreate {
  id: string;
  createdAt: string;
}

export const MAX_WINDOW_DAYS = 185;

/** Returns an error message, or null when the window is valid. */
export function validateWindow(w: WatchCreate, today: string): string | null {
  if (w.startDate > w.endDate) return "startDate must be on or before endDate";
  if (w.endDate < today) return "endDate is in the past";
  const days = (Date.parse(w.endDate) - Date.parse(w.startDate)) / 86_400_000;
  if (days > MAX_WINDOW_DAYS) return `date window exceeds ${MAX_WINDOW_DAYS} days`;
  return null;
}

export function isExpired(watch: Watch, today: string): boolean {
  return watch.endDate < today;
}

/**
 * Months (YYYY-MM-01) that need scanning to cover the given watches,
 * clipped to today and capped to keep one cron cycle polite.
 */
export function monthsToScan(watches: Watch[], today: string, cap = 4): string[] {
  const months = new Set<string>();
  for (const w of watches) {
    const from = w.startDate > today ? w.startDate : today;
    let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
    const [endY, endM] = [Number(w.endDate.slice(0, 4)), Number(w.endDate.slice(5, 7))];
    while (y < endY || (y === endY && m <= endM)) {
      months.add(`${y}-${String(m).padStart(2, "0")}-01`);
      m += 1;
      if (m === 13) [y, m] = [y + 1, 1];
    }
  }
  return [...months].sort().slice(0, cap);
}

export function matchOpened(watch: Watch, opened: OpenedSlot[]): OpenedSlot[] {
  return opened.filter((slot) => {
    if (slot.date < watch.startDate || slot.date > watch.endDate) return false;
    if (watch.siteTypes?.length) {
      const type = (slot.campsiteType ?? "").toUpperCase();
      if (!watch.siteTypes.some((t) => type.includes(t.toUpperCase()))) return false;
    }
    return true;
  });
}
