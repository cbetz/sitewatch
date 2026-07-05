import { RateLimitError, toSnapshot, type FetchAvailability } from "./availability.js";
import { diffSnapshots, snapshotChanged, type OpenedSlot } from "./diff.js";
import type { PushMessage, SendPush } from "./push.js";
import type { Storage } from "./storage.js";
import { isExpired, matchOpened, monthsToScan, type Watch } from "./watches.js";

export interface ScanDeps {
  storage: Storage;
  fetchAvailability: FetchAvailability;
  sendPush: SendPush;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  /** 100-300ms of politeness between availability requests */
  jitterMs: () => number;
  log: (msg: string) => void;
  killSwitch: () => boolean;
}

export interface ScanSummary {
  skipped: boolean;
  campgrounds: number;
  requests: number;
  opened: number;
  notified: number;
  expired: number;
  backedOff: number;
}

const BACKOFF_BASE_MS = 15 * 60_000;
const BACKOFF_MAX_MS = 6 * 3_600_000;

export async function runScan(deps: ScanDeps): Promise<ScanSummary> {
  const summary: ScanSummary = { skipped: false, campgrounds: 0, requests: 0, opened: 0, notified: 0, expired: 0, backedOff: 0 };
  if (deps.killSwitch()) {
    deps.log("scan: kill switch active, doing nothing");
    return { ...summary, skipped: true };
  }

  const today = deps.now().toISOString().slice(0, 10);
  const campgrounds = await deps.storage.listActiveCampgrounds();
  const pushes: PushMessage[] = [];

  for (const campgroundId of campgrounds) {
    const all = await deps.storage.listWatchesByCampground(campgroundId);
    const watches: Watch[] = [];
    for (const w of all) {
      if (isExpired(w, today)) {
        await deps.storage.deleteWatch(w);
        summary.expired += 1;
      } else {
        watches.push(w);
      }
    }
    if (watches.length === 0) continue;
    summary.campgrounds += 1;

    const backoff = await deps.storage.getBackoff(campgroundId);
    if (backoff && backoff.untilISO > deps.now().toISOString()) {
      summary.backedOff += 1;
      continue;
    }

    const opened: OpenedSlot[] = [];
    let rateLimited = false;
    for (const month of monthsToScan(watches, today)) {
      await deps.sleep(deps.jitterMs());
      summary.requests += 1;
      try {
        const next = toSnapshot(await deps.fetchAvailability(campgroundId, month), deps.now().toISOString());
        const prev = await deps.storage.getSnapshot(campgroundId, month);
        if (prev) opened.push(...diffSnapshots(prev, next));
        if (snapshotChanged(prev, next)) await deps.storage.putSnapshot(campgroundId, month, next);
      } catch (err) {
        if (err instanceof RateLimitError) {
          const failures = (backoff?.failures ?? 0) + 1;
          const delay = Math.min(BACKOFF_BASE_MS * 4 ** (failures - 1), BACKOFF_MAX_MS);
          await deps.storage.putBackoff(campgroundId, {
            failures,
            untilISO: new Date(deps.now().getTime() + delay).toISOString(),
          });
          deps.log(`scan: ${campgroundId} rate limited (HTTP ${err.status}), backing off ${Math.round(delay / 60_000)}m`);
          summary.backedOff += 1;
          rateLimited = true;
          break;
        }
        deps.log(`scan: ${campgroundId}/${month} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (rateLimited) continue;
    if (backoff) await deps.storage.putBackoff(campgroundId, null);

    summary.opened += opened.length;
    if (opened.length === 0) continue;
    for (const watch of watches) {
      const matches = matchOpened(watch, opened);
      if (matches.length === 0) continue;
      pushes.push(buildPushMessage(watch, matches));
      summary.notified += 1;
    }
  }

  if (pushes.length > 0) await deps.sendPush(pushes);
  deps.log(
    `scan: ${summary.campgrounds} campground(s), ${summary.requests} request(s), ${summary.opened} opening(s), ${summary.notified} notification(s)`,
  );
  return summary;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

function formatDates(dates: string[]): string {
  const shown = dates.slice(0, 3).map(formatDate);
  const rest = dates.length - 3;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more date(s)` : shown.join(", ");
}

export function buildPushMessage(watch: Watch, matches: OpenedSlot[]): PushMessage {
  const label = watch.campgroundName ?? `campground ${watch.campgroundId}`;
  const sites = [...new Set(matches.map((m) => m.campsiteId))];
  const dates = [...new Set(matches.map((m) => m.date))].sort();
  if (sites.length === 1) {
    const m = matches[0]!;
    return {
      to: watch.pushToken,
      title: "Campsite available",
      body: `Site ${m.site} at ${label} opened for ${formatDates(dates)}`,
      data: { url: `https://www.recreation.gov/camping/campsites/${m.campsiteId}`, watchId: watch.id },
    };
  }
  return {
    to: watch.pushToken,
    title: "Campsites available",
    body: `${sites.length} sites at ${label} opened for ${formatDates(dates)}`,
    data: { url: `https://www.recreation.gov/camping/campgrounds/${watch.campgroundId}`, watchId: watch.id },
  };
}
