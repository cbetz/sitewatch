import { describe, expect, it } from "vitest";
import type { AvailabilityMonth } from "../src/availability.js";
import { RateLimitError } from "../src/availability.js";
import type { PushMessage } from "../src/push.js";
import { runScan, type ScanDeps } from "../src/scan.js";
import { MemoryStorage } from "../src/storage.js";
import type { Watch } from "../src/watches.js";

const T0 = new Date("2026-07-04T12:00:00.000Z");

function month(sites: Record<string, { site: string; type?: string; days: Record<string, string> }>): AvailabilityMonth {
  return {
    campsites: Object.fromEntries(
      Object.entries(sites).map(([id, s]) => [
        id,
        {
          campsite_id: id,
          site: s.site,
          campsite_type: s.type ?? "STANDARD NONELECTRIC",
          availabilities: Object.fromEntries(Object.entries(s.days).map(([d, st]) => [`${d}T00:00:00Z`, st])),
        },
      ]),
    ),
  };
}

function watch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: "w1",
    pushToken: "ExponentPushToken[abc]",
    campgroundId: "232447",
    campgroundName: "Upper Pines",
    startDate: "2026-07-10",
    endDate: "2026-07-12",
    createdAt: T0.toISOString(),
    ...overrides,
  };
}

interface Harness {
  deps: ScanDeps;
  storage: MemoryStorage;
  pushes: PushMessage[];
  fetchCalls: string[];
  setResponse: (m: AvailabilityMonth | Error) => void;
  setNow: (d: Date) => void;
}

function makeHarness(): Harness {
  const storage = new MemoryStorage();
  const pushes: PushMessage[] = [];
  const fetchCalls: string[] = [];
  let response: AvailabilityMonth | Error = month({});
  let now = T0;
  const deps: ScanDeps = {
    storage,
    fetchAvailability: async (campgroundId, m) => {
      fetchCalls.push(`${campgroundId}/${m}`);
      if (response instanceof Error) throw response;
      return response;
    },
    sendPush: async (messages) => {
      pushes.push(...messages);
    },
    now: () => now,
    sleep: async () => {},
    jitterMs: () => 0,
    log: () => {},
    killSwitch: () => false,
  };
  return {
    deps,
    storage,
    pushes,
    fetchCalls,
    setResponse: (m) => {
      response = m;
    },
    setNow: (d) => {
      now = d;
    },
  };
}

describe("runScan", () => {
  it("does nothing when the kill switch is on", async () => {
    const h = makeHarness();
    await h.storage.putWatch(watch());
    const summary = await runScan({ ...h.deps, killSwitch: () => true });
    expect(summary.skipped).toBe(true);
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("seeds a baseline on first scan without notifying, then notifies on a transition", async () => {
    const h = makeHarness();
    await h.storage.putWatch(watch());
    h.setResponse(month({ "75": { site: "044", days: { "2026-07-10": "Reserved", "2026-07-11": "Reserved" } } }));

    const first = await runScan(h.deps);
    expect(first.opened).toBe(0);
    expect(h.pushes).toHaveLength(0);
    expect(h.fetchCalls).toEqual(["232447/2026-07-01"]);

    h.setResponse(month({ "75": { site: "044", days: { "2026-07-10": "Available", "2026-07-11": "Reserved" } } }));
    const second = await runScan(h.deps);
    expect(second.opened).toBe(1);
    expect(second.notified).toBe(1);
    expect(h.pushes).toHaveLength(1);
    expect(h.pushes[0]!.body).toBe("Site 044 at Upper Pines opened for Jul 10");
    expect(h.pushes[0]!.data!.url).toBe("https://www.recreation.gov/camping/campsites/75");
  });

  it("does not re-notify while a slot stays Available", async () => {
    const h = makeHarness();
    await h.storage.putWatch(watch());
    h.setResponse(month({ "75": { site: "044", days: { "2026-07-10": "Reserved" } } }));
    await runScan(h.deps);
    h.setResponse(month({ "75": { site: "044", days: { "2026-07-10": "Available" } } }));
    await runScan(h.deps);
    await runScan(h.deps);
    expect(h.pushes).toHaveLength(1);
  });

  it("respects date windows and site-type filters", async () => {
    const h = makeHarness();
    await h.storage.putWatch(watch({ id: "w-tent", pushToken: "t-tent", siteTypes: ["TENT"] }));
    await h.storage.putWatch(watch({ id: "w-any", pushToken: "t-any" }));
    await h.storage.putWatch(watch({ id: "w-late", pushToken: "t-late", startDate: "2026-07-20", endDate: "2026-07-25" }));
    h.setResponse(
      month({
        "75": { site: "044", type: "STANDARD NONELECTRIC", days: { "2026-07-10": "Reserved" } },
      }),
    );
    await runScan(h.deps);
    h.setResponse(
      month({
        "75": { site: "044", type: "STANDARD NONELECTRIC", days: { "2026-07-10": "Available" } },
      }),
    );
    await runScan(h.deps);
    const tokens = h.pushes.map((p) => p.to).sort();
    expect(tokens).toEqual(["t-any"]);
  });

  it("backs off on rate limiting and skips until the window passes", async () => {
    const h = makeHarness();
    await h.storage.putWatch(watch());
    h.setResponse(new RateLimitError(429));
    const first = await runScan(h.deps);
    expect(first.backedOff).toBe(1);
    expect(h.fetchCalls).toHaveLength(1);

    const second = await runScan(h.deps);
    expect(second.backedOff).toBe(1);
    expect(h.fetchCalls).toHaveLength(1);

    h.setNow(new Date(T0.getTime() + 16 * 60_000));
    h.setResponse(month({ "75": { site: "044", days: { "2026-07-10": "Reserved" } } }));
    const third = await runScan(h.deps);
    expect(third.requests).toBe(1);
    expect(h.fetchCalls).toHaveLength(2);
    expect(await h.storage.getBackoff("232447")).toBeNull();
  });

  it("deletes expired watches and stops scanning their campground", async () => {
    const h = makeHarness();
    await h.storage.putWatch(watch({ startDate: "2026-06-01", endDate: "2026-06-30" }));
    const summary = await runScan(h.deps);
    expect(summary.expired).toBe(1);
    expect(summary.campgrounds).toBe(0);
    expect(h.fetchCalls).toHaveLength(0);
    expect(await h.storage.listActiveCampgrounds()).toEqual([]);
  });

  it("groups multiple opened sites into one push per watch", async () => {
    const h = makeHarness();
    await h.storage.putWatch(watch());
    h.setResponse(
      month({
        "75": { site: "044", days: { "2026-07-10": "Reserved" } },
        "76": { site: "045", days: { "2026-07-11": "Reserved" } },
      }),
    );
    await runScan(h.deps);
    h.setResponse(
      month({
        "75": { site: "044", days: { "2026-07-10": "Available" } },
        "76": { site: "045", days: { "2026-07-11": "Available" } },
      }),
    );
    await runScan(h.deps);
    expect(h.pushes).toHaveLength(1);
    expect(h.pushes[0]!.body).toBe("2 sites at Upper Pines opened for Jul 10, Jul 11");
    expect(h.pushes[0]!.data!.url).toBe("https://www.recreation.gov/camping/campgrounds/232447");
  });
});
