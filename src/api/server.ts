import { getServerUrl } from "../lib/config";
import type { Facility, Watch, WatchCreateInput } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await getServerUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the status message
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

interface RidbFacility {
  FacilityID: string;
  FacilityName: string;
  FacilityTypeDescription?: string;
  FacilityLatitude?: number;
  FacilityLongitude?: number;
  FacilityDescription?: string;
  Reservable?: boolean;
}

export async function searchFacilities(query: string, state?: string): Promise<Facility[]> {
  const params = new URLSearchParams({ query, limit: "25" });
  if (state) params.set("state", state);
  const data = await request<{ RECDATA?: RidbFacility[] }>(`/api/facilities?${params}`);
  return (data.RECDATA ?? [])
    .filter((f) => f.Reservable !== false && (f.FacilityTypeDescription ?? "").toLowerCase() === "campground")
    .map((f) => ({
      id: String(f.FacilityID),
      name: f.FacilityName,
      latitude: f.FacilityLatitude ?? null,
      longitude: f.FacilityLongitude ?? null,
      description: (f.FacilityDescription ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }));
}

export async function listWatches(pushToken: string): Promise<Watch[]> {
  const data = await request<{ watches: Watch[] }>(`/api/watches?pushToken=${encodeURIComponent(pushToken)}`);
  return data.watches;
}

export async function createWatch(input: WatchCreateInput): Promise<Watch> {
  return request<Watch>("/api/watches", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteWatch(id: string, pushToken: string): Promise<void> {
  await request<void>(`/api/watches/${id}?pushToken=${encodeURIComponent(pushToken)}`, { method: "DELETE" });
}
