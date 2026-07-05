import { Hono } from "hono";
import type { ScanSummary } from "./scan.js";
import type { Storage } from "./storage.js";
import { isExpired, validateWindow, watchCreateSchema, type Watch } from "./watches.js";

export interface AppDeps {
  storage: Storage;
  scan: () => Promise<ScanSummary>;
  now: () => Date;
  /** When set, /cron/scan requires Authorization: Bearer <cronSecret> (Vercel sends this automatically). */
  cronSecret?: string;
  /** RIDB facility-search proxy so the client app never ships the API key. Absent key -> 501. */
  ridbApiKey?: string;
  fetchImpl?: typeof fetch;
}

const RIDB_BASE = "https://ridb.recreation.gov/api/v1";
const RIDB_ALLOWED_PARAMS = ["query", "state", "limit", "offset", "latitude", "longitude", "radius", "activity"];

export function createApp(deps: AppDeps) {
  const app = new Hono().basePath("/api");
  const fetchImpl = deps.fetchImpl ?? fetch;

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/watches", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    const parsed = watchCreateSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, 400);
    const windowError = validateWindow(parsed.data, deps.now().toISOString().slice(0, 10));
    if (windowError) return c.json({ error: windowError }, 400);

    const watch: Watch = { ...parsed.data, id: crypto.randomUUID(), createdAt: deps.now().toISOString() };
    await deps.storage.putWatch(watch);
    return c.json(watch, 201);
  });

  app.get("/watches", async (c) => {
    const pushToken = c.req.query("pushToken");
    if (!pushToken) return c.json({ error: "pushToken query param required" }, 400);
    const today = deps.now().toISOString().slice(0, 10);
    const watches = await deps.storage.listWatchesByToken(pushToken);
    const active: Watch[] = [];
    for (const w of watches) {
      if (isExpired(w, today)) await deps.storage.deleteWatch(w);
      else active.push(w);
    }
    return c.json({ watches: active });
  });

  app.delete("/watches/:id", async (c) => {
    const pushToken = c.req.query("pushToken");
    if (!pushToken) return c.json({ error: "pushToken query param required" }, 400);
    const watch = await deps.storage.getWatch(c.req.param("id"));
    if (!watch) return c.json({ error: "not found" }, 404);
    if (watch.pushToken !== pushToken) return c.json({ error: "forbidden" }, 403);
    await deps.storage.deleteWatch(watch);
    return c.body(null, 204);
  });

  app.get("/cron/scan", async (c) => {
    if (deps.cronSecret && c.req.header("Authorization") !== `Bearer ${deps.cronSecret}`) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return c.json(await deps.scan());
  });

  app.get("/facilities", async (c) => {
    if (!deps.ridbApiKey) return c.json({ error: "RIDB_API_KEY not configured" }, 501);
    const params = new URLSearchParams();
    for (const key of RIDB_ALLOWED_PARAMS) {
      const value = c.req.query(key);
      if (value) params.set(key, value);
    }
    if (!params.has("limit")) params.set("limit", "20");
    const res = await fetchImpl(`${RIDB_BASE}/facilities?${params}`, {
      headers: { apikey: deps.ridbApiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return c.json({ error: `RIDB responded ${res.status}` }, 502);
    return c.json(await res.json());
  });

  return app;
}
