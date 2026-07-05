export const Colors = {
  background: "#FFFFFF",
  card: "#F2F3F5",
  border: "#DDE0E4",
  text: "#1A1D21",
  textSecondary: "#5F6670",
  accent: "#1F6E43",
  accentSoft: "#E3F2E9",
  danger: "#B3261E",
  available: "#2E9E5B",
  reserved: "#D5D8DC",
  closed: "#9AA0A6",
  selected: "#1F6E43",
} as const;

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export function statusColor(status: string | undefined): string {
  if (status === "Available" || status === "Open") return Colors.available;
  if (status === "Reserved") return Colors.reserved;
  return Colors.closed;
}

export function isBookable(status: string | undefined): boolean {
  return status === "Available" || status === "Open";
}
