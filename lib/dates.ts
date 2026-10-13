// Pure string helpers for backend `YYYY-MM-DD` dates (no timezone shifting).

function toParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function fromUTC(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const { y, m, d } = toParts(iso);
  return fromUTC(new Date(Date.UTC(y, m - 1, d + days)));
}

export function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export function startOfPrevMonth(iso: string) {
  const { y, m } = toParts(iso);
  return fromUTC(new Date(Date.UTC(y, m - 2, 1)));
}

export function daysBetween(start: string, end: string) {
  const a = toParts(start);
  const b = toParts(end);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}
