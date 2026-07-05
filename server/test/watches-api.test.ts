import { describe, expect, it } from "vitest";
import { createApp } from "../src/routes.js";
import { MemoryStorage } from "../src/storage.js";

const NOW = new Date("2026-07-04T12:00:00.000Z");

function makeApp(storage = new MemoryStorage()) {
  const app = createApp({
    storage,
    scan: async () => ({ skipped: false, campgrounds: 0, requests: 0, opened: 0, notified: 0, expired: 0, backedOff: 0 }),
    now: () => NOW,
    cronSecret: "test-secret",
  });
  return { app, storage };
}

const validBody = {
  pushToken: "ExponentPushToken[abc123]",
  campgroundId: "232447",
  campgroundName: "Upper Pines",
  startDate: "2026-07-10",
  endDate: "2026-07-12",
};

function post(app: ReturnType<typeof makeApp>["app"], body: unknown) {
  return app.request("/api/watches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("watches CRUD", () => {
  it("creates a watch and lists it by token", async () => {
    const { app } = makeApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(201);
    const watch = (await res.json()) as { id: string };
    expect(watch.id).toBeTruthy();

    const list = await app.request("/api/watches?pushToken=ExponentPushToken%5Babc123%5D");
    expect(list.status).toBe(200);
    const { watches } = (await list.json()) as { watches: Array<{ campgroundId: string }> };
    expect(watches).toHaveLength(1);
    expect(watches[0]?.campgroundId).toBe("232447");
  });

  it("rejects invalid bodies and windows", async () => {
    const { app } = makeApp();
    expect((await post(app, { ...validBody, campgroundId: "not-a-number" })).status).toBe(400);
    expect((await post(app, { ...validBody, startDate: "2026-07-12", endDate: "2026-07-10" })).status).toBe(400);
    expect((await post(app, { ...validBody, startDate: "2026-06-01", endDate: "2026-06-30" })).status).toBe(400);
    expect((await post(app, { ...validBody, endDate: "2027-06-30" })).status).toBe(400);
    expect((await post(app, "not json at all")).status).toBe(400);
  });

  it("deletes only with the owning token", async () => {
    const { app } = makeApp();
    const { id } = (await (await post(app, validBody)).json()) as { id: string };

    const forbidden = await app.request(`/api/watches/${id}?pushToken=someone-else`, { method: "DELETE" });
    expect(forbidden.status).toBe(403);

    const missingToken = await app.request(`/api/watches/${id}`, { method: "DELETE" });
    expect(missingToken.status).toBe(400);

    const ok = await app.request(`/api/watches/${id}?pushToken=ExponentPushToken%5Babc123%5D`, { method: "DELETE" });
    expect(ok.status).toBe(204);

    const gone = await app.request(`/api/watches/${id}?pushToken=ExponentPushToken%5Babc123%5D`, { method: "DELETE" });
    expect(gone.status).toBe(404);
  });

  it("prunes expired watches on list", async () => {
    const { app } = makeApp();
    await post(app, { ...validBody, startDate: "2026-07-01", endDate: "2026-07-03" });
    const { watches } = (await (await app.request("/api/watches?pushToken=ExponentPushToken%5Babc123%5D")).json()) as {
      watches: unknown[];
    };
    expect(watches).toHaveLength(0);
  });
});

describe("cron auth", () => {
  it("rejects a missing or wrong bearer token and accepts the right one", async () => {
    const { app } = makeApp();
    expect((await app.request("/api/cron/scan")).status).toBe(401);
    expect((await app.request("/api/cron/scan", { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
    const ok = await app.request("/api/cron/scan", { headers: { Authorization: "Bearer test-secret" } });
    expect(ok.status).toBe(200);
  });
});

describe("facilities proxy", () => {
  it("returns 501 when no RIDB key is configured", async () => {
    const { app } = makeApp();
    expect((await app.request("/api/facilities?query=yosemite")).status).toBe(501);
  });

  it("forwards whitelisted params with the apikey header", async () => {
    let captured: { url: string; headers: Record<string, string> } | null = null;
    const fetchImpl = (async (url: any, init: any) => {
      captured = { url: String(url), headers: init.headers };
      return new Response(JSON.stringify({ RECDATA: [] }), { status: 200 });
    }) as typeof fetch;
    const app = createApp({
      storage: new MemoryStorage(),
      scan: async () => ({ skipped: true, campgrounds: 0, requests: 0, opened: 0, notified: 0, expired: 0, backedOff: 0 }),
      now: () => NOW,
      ridbApiKey: "test-key",
      fetchImpl,
    });
    const res = await app.request("/api/facilities?query=yosemite&state=CA&evil=1");
    expect(res.status).toBe(200);
    expect(captured!.url).toContain("query=yosemite");
    expect(captured!.url).toContain("state=CA");
    expect(captured!.url).not.toContain("evil");
    expect(captured!.headers.apikey).toBe("test-key");
  });
});
