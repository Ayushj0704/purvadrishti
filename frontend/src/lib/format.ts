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

export function formatTime(value: string | number | Date): string {
  return timeFmt.format(new Date(value));
}

export function formatDateTime(value: string | number | Date): string {
  return dateTimeFmt.format(new Date(value));
}

export function formatWindow(
  start: string | number | Date,
  end: string | number | Date,
): string {
  return `${formatTime(start)} — ${formatTime(end)}`;
}

export function formatInr(value: number): string {
  return inrFmt.format(value);
}

export function formatCompact(value: number): string {
  return compactFmt.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function minutesBetween(a: string | number | Date, b: string | number | Date): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}
