import { describe, expect, it } from "vitest";
import type { Snapshot } from "../src/availability.js";
import { diffSnapshots, snapshotChanged } from "../src/diff.js";

function snapshot(campsites: Record<string, Record<string, string>>, meta?: Record<string, { site?: string; campsiteType?: string }>): Snapshot {
  return {
    fetchedAt: "2026-07-04T12:00:00.000Z",
    campsites: Object.fromEntries(
      Object.entries(campsites).map(([id, availabilities]) => [
        id,
        { site: meta?.[id]?.site ?? `S${id}`, campsiteType: meta?.[id]?.campsiteType, availabilities },
      ]),
    ),
  };
}

describe("diffSnapshots", () => {
  it("reports Reserved -> Available transitions", () => {
    const prev = snapshot({ "75": { "2026-07-10": "Reserved", "2026-07-11": "Reserved" } });
    const next = snapshot({ "75": { "2026-07-10": "Available", "2026-07-11": "Reserved" } });
    expect(diffSnapshots(prev, next)).toEqual([
      { campsiteId: "75", site: "S75", campsiteType: undefined, date: "2026-07-10" },
    ]);
  });

  it("ignores slots that were already Available", () => {
    const prev = snapshot({ "75": { "2026-07-10": "Available" } });
    const next = snapshot({ "75": { "2026-07-10": "Available" } });
    expect(diffSnapshots(prev, next)).toEqual([]);
  });

  it("ignores dates and sites with no prior observation", () => {
    const prev = snapshot({ "75": { "2026-07-10": "Reserved" } });
    const next = snapshot({
      "75": { "2026-07-10": "Reserved", "2026-08-01": "Available" },
      "99": { "2026-07-10": "Available" },
    });
    expect(diffSnapshots(prev, next)).toEqual([]);
  });

  it("reports Closed -> Available and sorts by date", () => {
    const prev = snapshot({ "75": { "2026-07-12": "Closed", "2026-07-10": "Not Reservable" } });
    const next = snapshot({ "75": { "2026-07-12": "Available", "2026-07-10": "Available" } });
    expect(diffSnapshots(prev, next).map((o) => o.date)).toEqual(["2026-07-10", "2026-07-12"]);
  });
});

describe("snapshotChanged", () => {
  it("is true without a previous snapshot and false for identical content", () => {
    const a = snapshot({ "75": { "2026-07-10": "Reserved" } });
    const b = snapshot({ "75": { "2026-07-10": "Reserved" } });
    const c = snapshot({ "75": { "2026-07-10": "Available" } });
    expect(snapshotChanged(null, a)).toBe(true);
    expect(snapshotChanged(a, b)).toBe(false);
    expect(snapshotChanged(a, c)).toBe(true);
  });
});
