import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAvailability, toSnapshot } from "../src/availability.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/availability-232447.json", import.meta.url), "utf8"));

describe("parseAvailability", () => {
  it("parses a real Recreation.gov response", () => {
    const month = parseAvailability(fixture);
    const ids = Object.keys(month.campsites);
    expect(ids).toEqual(["75", "76", "77"]);
    for (const id of ids) {
      const site = month.campsites[id]!;
      expect(site.site).toBeTruthy();
      expect(Object.keys(site.availabilities).length).toBeGreaterThan(0);
    }
  });

  it("rejects a response without campsites", () => {
    expect(() => parseAvailability({ error: "nope" })).toThrow();
  });

  it("rejects campsites with malformed availabilities", () => {
    expect(() =>
      parseAvailability({ campsites: { "1": { campsite_id: "1", site: "A1", availabilities: "broken" } } }),
    ).toThrow();
  });
});

describe("toSnapshot", () => {
  it("normalizes ISO datetime keys to YYYY-MM-DD and keeps statuses", () => {
    const snapshot = toSnapshot(parseAvailability(fixture), "2026-07-04T12:00:00.000Z");
    const site = snapshot.campsites["75"]!;
    for (const date of Object.keys(site.availabilities)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const statuses = new Set(Object.values(site.availabilities));
    expect([...statuses].every((s) => typeof s === "string")).toBe(true);
    expect(snapshot.fetchedAt).toBe("2026-07-04T12:00:00.000Z");
  });
});
