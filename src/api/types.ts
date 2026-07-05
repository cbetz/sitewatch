export interface Facility {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
}

export interface Watch {
  id: string;
  pushToken: string;
  campgroundId: string;
  campgroundName?: string;
  startDate: string;
  endDate: string;
  siteTypes?: string[];
  createdAt: string;
}

export interface WatchCreateInput {
  pushToken: string;
  campgroundId: string;
  campgroundName?: string;
  startDate: string;
  endDate: string;
  siteTypes?: string[];
}

export interface SiteRow {
  campsiteId: string;
  site: string;
  loop: string;
  type: string;
  /** date (YYYY-MM-DD) -> status */
  days: Record<string, string>;
}

export interface MonthAvailability {
  dates: string[];
  sites: SiteRow[];
}
