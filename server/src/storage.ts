import type { Snapshot } from "./availability.js";
import type { Watch } from "./watches.js";

export interface Backoff {
  failures: number;
  /** ISO timestamp before which the campground must not be scanned */
  untilISO: string;
}

export interface Storage {
  getWatch(id: string): Promise<Watch | null>;
  putWatch(watch: Watch): Promise<void>;
  deleteWatch(watch: Watch): Promise<void>;
  listWatchesByToken(pushToken: string): Promise<Watch[]>;
  listWatchesByCampground(campgroundId: string): Promise<Watch[]>;
  listActiveCampgrounds(): Promise<string[]>;
  getSnapshot(campgroundId: string, month: string): Promise<Snapshot | null>;
  putSnapshot(campgroundId: string, month: string, snapshot: Snapshot): Promise<void>;
  getBackoff(campgroundId: string): Promise<Backoff | null>;
  putBackoff(campgroundId: string, backoff: Backoff | null): Promise<void>;
}

/** In-memory storage for tests and local development. Not persistent. */
export class MemoryStorage implements Storage {
  private watches = new Map<string, Watch>();
  private snapshots = new Map<string, Snapshot>();
  private backoffs = new Map<string, Backoff>();

  async getWatch(id: string): Promise<Watch | null> {
    return this.watches.get(id) ?? null;
  }
  async putWatch(watch: Watch): Promise<void> {
    this.watches.set(watch.id, watch);
  }
  async deleteWatch(watch: Watch): Promise<void> {
    this.watches.delete(watch.id);
  }
  async listWatchesByToken(pushToken: string): Promise<Watch[]> {
    return [...this.watches.values()].filter((w) => w.pushToken === pushToken);
  }
  async listWatchesByCampground(campgroundId: string): Promise<Watch[]> {
    return [...this.watches.values()].filter((w) => w.campgroundId === campgroundId);
  }
  async listActiveCampgrounds(): Promise<string[]> {
    return [...new Set([...this.watches.values()].map((w) => w.campgroundId))].sort();
  }
  async getSnapshot(campgroundId: string, month: string): Promise<Snapshot | null> {
    return this.snapshots.get(`${campgroundId}|${month}`) ?? null;
  }
  async putSnapshot(campgroundId: string, month: string, snapshot: Snapshot): Promise<void> {
    this.snapshots.set(`${campgroundId}|${month}`, snapshot);
  }
  async getBackoff(campgroundId: string): Promise<Backoff | null> {
    return this.backoffs.get(campgroundId) ?? null;
  }
  async putBackoff(campgroundId: string, backoff: Backoff | null): Promise<void> {
    if (backoff) this.backoffs.set(campgroundId, backoff);
    else this.backoffs.delete(campgroundId);
  }
}
