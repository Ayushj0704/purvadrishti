const EM_DASH = "—";

const timeFmt = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactFmt = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Guards on every formatter.
 *
 * Most of the values reaching these come straight off the API, and a lot of
 * them are legitimately nullable: a case with no recorded victim location, a
 * prediction with no clock bound, an amount that was never captured. Passing
 * null to Intl produces "Invalid Date" or "₹NaN", which reads as a bug rather
 * than as missing data — so nullish and unparseable input collapses to a dash.
 */
function isPresent(value: unknown): value is string | number | Date {
  if (value === null || value === undefined || value === "") return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function toDate(value: string | number | Date): Date | null {
  if (!isPresent(value)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(value: string | number | Date): string {
  const date = toDate(value);
  return date ? timeFmt.format(date) : EM_DASH;
}

export function formatDateTime(value: string | number | Date): string {
  const date = toDate(value);
  return date ? dateTimeFmt.format(date) : EM_DASH;
}

export function formatWindow(
  start: string | number | Date,
  end: string | number | Date,
): string {
  return `${formatTime(start)} ${EM_DASH} ${formatTime(end)}`;
}

export function formatInr(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return EM_DASH;
  return inrFmt.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return EM_DASH;
  return compactFmt.format(value);
}

/** Model probability as a whole percentage, clamped to the 0-100 range. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return EM_DASH;
  return `${(value * 100).toFixed(digits)}%`;
}

export function minutesBetween(a: string | number | Date, b: string | number | Date): number {
  const from = toDate(a);
  const to = toDate(b);
  if (!from || !to) return 0;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

/** Replaces an absent string so a table cell never renders as blank-by-accident. */
export function orDash(value: string | null | undefined): string {
  return isPresent(value) ? String(value) : EM_DASH;
}
