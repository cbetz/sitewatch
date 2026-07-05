import { Redis } from "@upstash/redis";
import type { Snapshot } from "./availability.js";
import type { Watch } from "./watches.js";
import type { Backoff, Storage } from "./storage.js";

/**
 * Upstash Redis storage (REST client, provisioned via the Vercel Marketplace).
 * Keys:
 *   w:{id}        watch JSON
 *   t:{token}     set of watch ids owned by a push token
 *   cg:{id}       set of watch ids for a campground
 *   cgs           set of campground ids with at least one watch
 *   snap:{cg}:{month}  snapshot JSON
 *   backoff:{cg}  backoff JSON, expiring at untilISO
 */
export class RedisStorage implements Storage {
  constructor(private redis: Redis) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): RedisStorage {
    const url = env.UPSTASH_REDIS_REST_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set");
    return new RedisStorage(new Redis({ url, token }));
  }

  async getWatch(id: string): Promise<Watch | null> {
    return (await this.redis.get<Watch>(`w:${id}`)) ?? null;
  }

  async putWatch(watch: Watch): Promise<void> {
    await Promise.all([
      this.redis.set(`w:${watch.id}`, watch),
      this.redis.sadd(`t:${watch.pushToken}`, watch.id),
      this.redis.sadd(`cg:${watch.campgroundId}`, watch.id),
      this.redis.sadd("cgs", watch.campgroundId),
    ]);
  }

  async deleteWatch(watch: Watch): Promise<void> {
    await Promise.all([
      this.redis.del(`w:${watch.id}`),
      this.redis.srem(`t:${watch.pushToken}`, watch.id),
      this.redis.srem(`cg:${watch.campgroundId}`, watch.id),
    ]);
    const remaining = await this.redis.scard(`cg:${watch.campgroundId}`);
    if (remaining === 0) await this.redis.srem("cgs", watch.campgroundId);
  }

  async listWatchesByToken(pushToken: string): Promise<Watch[]> {
    return this.membersToWatches(await this.redis.smembers(`t:${pushToken}`));
  }

  async listWatchesByCampground(campgroundId: string): Promise<Watch[]> {
    return this.membersToWatches(await this.redis.smembers(`cg:${campgroundId}`));
  }

  async listActiveCampgrounds(): Promise<string[]> {
    return ((await this.redis.smembers("cgs")) as string[]).sort();
  }

  async getSnapshot(campgroundId: string, month: string): Promise<Snapshot | null> {
    return (await this.redis.get<Snapshot>(`snap:${campgroundId}:${month}`)) ?? null;
  }

  async putSnapshot(campgroundId: string, month: string, snapshot: Snapshot): Promise<void> {
    // Snapshots for a past month are dead weight; expire them after 60 days.
    await this.redis.set(`snap:${campgroundId}:${month}`, snapshot, { ex: 60 * 86_400 });
  }

  async getBackoff(campgroundId: string): Promise<Backoff | null> {
    return (await this.redis.get<Backoff>(`backoff:${campgroundId}`)) ?? null;
  }

  async putBackoff(campgroundId: string, backoff: Backoff | null): Promise<void> {
    if (backoff) await this.redis.set(`backoff:${campgroundId}`, backoff, { ex: 86_400 });
    else await this.redis.del(`backoff:${campgroundId}`);
  }

  private async membersToWatches(ids: string[]): Promise<Watch[]> {
    if (ids.length === 0) return [];
    const values = await this.redis.mget<(Watch | null)[]>(...ids.map((id) => `w:${id}`));
    return values.filter((w): w is Watch => w !== null);
  }
}
