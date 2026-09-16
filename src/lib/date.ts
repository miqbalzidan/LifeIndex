/**
 * Everything here works in the device's local calendar.
 *
 * That matters more than it looks: an entry written at 11pm belongs to that
 * night, and using UTC would file it under tomorrow for anyone west of
 * Greenwich. So dates are formatted from local components and parsed back into
 * local midnight, never through `Date.parse` of an ISO string.
 */

/** `YYYY-MM-DD` for a local date. */
export function toIso(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/** Local midnight for a `YYYY-MM-DD` string. */
export function fromIso(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(now: Date = new Date()): string {
  return toIso(now);
}

/** Minutes past local midnight. */
export function minutesNow(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * The `count` calendar dates ending today, most recent first — including days
 * with nothing recorded, which is what makes "23 of the last 30" honest.
 */
export function recentDates(count: number, now: Date = new Date()): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  }
  return dates;
}

/**
 * The same day-of-month, `months` back, clamped to the length of that month.
 * Without the clamp, `new Date(y, m - 1, 31)` silently rolls forward — asking
 * for one month before March 31st would hand back March 3rd and label a
 * stranger's entry "one month ago".
 */
export function monthsAgoIso(months: number, now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() - months;
  const lastDayOfTargetMonth = new Date(y, m + 1, 0).getDate();
  return toIso(new Date(y, m, Math.min(now.getDate(), lastDayOfTargetMonth)));
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return fromIso(iso).toLocaleDateString(undefined, opts);
}

/**
 * An archive row's date, carrying the year only when it isn't the current one.
 * A journal kept for a few years otherwise lists two "September 9"s with
 * nothing to tell them apart.
 */
export function formatEntryDate(iso: string, now: Date = new Date()): string {
  const sameYear = fromIso(iso).getFullYear() === now.getFullYear();
  return formatDate(
    iso,
    sameYear ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" }
  );
}

/** Minutes past midnight as a lowercase 12-hour clock, e.g. `10:14pm`. */
export function formatTime(mins: number): string {
  const total = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

/**
 * Minutes past midnight as `<input type="time">` wants them, and back.
 *
 * That control always speaks 24-hour `HH:MM` whatever it shows the user, so
 * this is a fixed format rather than a localised one.
 */
export function toTimeInput(mins: number): string {
  const total = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Minutes past midnight, or `null` if the field is empty or not a time. */
export function fromTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
