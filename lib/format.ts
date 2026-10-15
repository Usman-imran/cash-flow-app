import { DENOMINATIONS, type NoteCounts } from "@/lib/api";

const currencyFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 2,
});

const timeFormatter = new Intl.DateTimeFormat("en-PK", {
  hour: "numeric",
  minute: "2-digit",
});

const exactTimeFormatter = new Intl.DateTimeFormat("en-PK", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-PK", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatTime(iso: string) {
  return timeFormatter.format(new Date(iso));
}

export function formatExactTime(iso: string) {
  return exactTimeFormatter.format(new Date(iso));
}

export function formatLongDate(date: Date) {
  return dateFormatter.format(date);
}

/** Formats a backend `YYYY-MM-DD` date without shifting it through UTC. */
export function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

const shortDateFormatter = new Intl.DateTimeFormat("en-PK", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Short form of a backend `YYYY-MM-DD` date, e.g. "Tue, 13 Oct 2026". */
export function formatShortDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return shortDateFormatter.format(new Date(y, m - 1, d));
}

/** e.g. "2×5000 · 3×100 · coins 7" */
export function noteBreakdown(counts: NoteCounts) {
  const parts = DENOMINATIONS.filter((d) => counts[`note_${d}`] > 0).map((d) => `${counts[`note_${d}`]}×${d}`);
  if (counts.coins > 0) parts.push(`coins ${counts.coins}`);
  return parts.join(" · ");
}
