import { createAvailabilityClient } from "./availability.js";
import { createExpoPushSender } from "./push.js";
import { runScan, type ScanDeps } from "./scan.js";
import { MemoryStorage, type Storage } from "./storage.js";
import { RedisStorage } from "./storage-redis.js";
import { createApp } from "./routes.js";

function createStorage(env: NodeJS.ProcessEnv): Storage {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) return RedisStorage.fromEnv(env);
  console.warn("storage: Upstash env vars missing, using non-persistent in-memory storage");
  return new MemoryStorage();
}

/** Wires the real dependencies from process.env. Used by the Vercel entry and the local dev server. */
export function createProductionApp(env: NodeJS.ProcessEnv = process.env) {
  const storage = createStorage(env);
  const scanDeps: ScanDeps = {
    storage,
    fetchAvailability: createAvailabilityClient(),
    sendPush: createExpoPushSender(),
    now: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    jitterMs: () => 100 + Math.floor(Math.random() * 200),
    log: console.log,
    killSwitch: () => env.SCAN_KILL_SWITCH === "1",
  };
  return createApp({
    storage,
    scan: () => runScan(scanDeps),
    now: () => new Date(),
    cronSecret: env.CRON_SECRET,
    ridbApiKey: env.RIDB_API_KEY,
  });
}
