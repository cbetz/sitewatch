import { Redis } from "@upstash/redis";
import { createAvailabilityClient } from "./availability.js";
import { createExpoPushSender } from "./push.js";
import { runScan, type ScanDeps } from "./scan.js";
import { MemoryStorage, type Storage } from "./storage.js";
import { RedisStorage } from "./storage-redis.js";
import { createApp, type StorageMode } from "./routes.js";

function createStorage(env: NodeJS.ProcessEnv): { storage: Storage; mode: StorageMode } {
  // The Upstash Marketplace integration exports KV_*-prefixed vars (Vercel KV
  // compatible naming); direct Upstash setups use UPSTASH_*. Accept both.
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (url && token) return { storage: new RedisStorage(new Redis({ url, token })), mode: "redis" };
  console.warn("storage: no Redis credentials found, using non-persistent in-memory storage");
  return { storage: new MemoryStorage(), mode: "memory" };
}

/** Wires the real dependencies from process.env. Used by the Vercel entry and the local dev server. */
export function createProductionApp(env: NodeJS.ProcessEnv = process.env) {
  const { storage, mode } = createStorage(env);
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
    storageMode: mode,
    scan: () => runScan(scanDeps),
    now: () => new Date(),
    cronSecret: env.CRON_SECRET,
    ridbApiKey: env.RIDB_API_KEY,
  });
}
