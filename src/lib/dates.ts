const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** First of the month containing d, as YYYY-MM-01. */
export function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function addMonths(month: string, delta: number): string {
  let y = Number(month.slice(0, 4));
  let m = Number(month.slice(5, 7)) + delta;
  while (m < 1) (m += 12), (y -= 1);
  while (m > 12) (m -= 12), (y += 1);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

export function shortDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${dayOfMonth(date)}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
