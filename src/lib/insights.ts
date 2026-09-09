import { CHART_WINDOW_DAYS, CLEAN_WINDOW_DAYS } from "./constants.ts";
import { formatTime, recentDates } from "./date.ts";
import type { Day, Rating } from "../types.ts";

type Days = Record<string, Day>;

const recorded = (days: Days, dates: string[]): Day[] =>
  dates.map((d) => days[d]).filter((d): d is Day => d !== undefined);

/**
 * Days in the window with no urge you gave in to.
 *
 * Counted over calendar days, not over days you happened to open the app, and
 * always reported as a share of the window. A day you never touched counts as
 * clean — the stat measures the thing being tracked, not your attendance, and
 * it must never behave like a streak that resets to zero.
 */
export function countCleanDays(days: Days, now = new Date()): number {
  return recentDates(CLEAN_WINDOW_DAYS, now).filter((date) => {
    const day = days[date];
    return !day || !day.urges.some((u) => u.outcome === "gave");
  }).length;
}

/** How many days in the headline window hold anything at all. */
export function countRecordedDays(days: Days, now = new Date()): number {
  return recorded(days, recentDates(CLEAN_WINDOW_DAYS, now)).length;
}

export interface HourHistogram {
  counts: number[];
  peakHour: number;
  total: number;
  /** Share of urges falling between 9pm and 2am, as a whole percentage. */
  lateShare: number;
}

export function buildHourHistogram(days: Days, now = new Date()): HourHistogram {
  const counts = new Array<number>(24).fill(0);
  for (const day of recorded(days, recentDates(CHART_WINDOW_DAYS, now))) {
    for (const urge of day.urges) {
      const hour = Math.floor(urge.t / 60) % 24;
      counts[hour] = (counts[hour] ?? 0) + 1;
    }
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const peak = Math.max(...counts);
  const late = [21, 22, 23, 0, 1].reduce((sum, h) => sum + (counts[h] ?? 0), 0);
  return {
    counts,
    peakHour: total > 0 ? counts.indexOf(peak) : -1,
    total,
    lateShare: total > 0 ? Math.round((late / total) * 100) : 0,
  };
}

export function hourNote(hist: HourHistogram): string {
  if (hist.total === 0) return "";
  return (
    `Heaviest around ${formatTime(hist.peakHour * 60)}. ` +
    `${hist.lateShare}% fall between 9pm and 2am.`
  );
}

/** Mood over the last 30 calendar days, oldest first; `null` where nothing was set. */
export function buildMoodSeries(days: Days, now = new Date()): (Rating | null)[] {
  return recentDates(CLEAN_WINDOW_DAYS, now)
    .slice()
    .reverse()
    .map((date) => days[date]?.mood ?? null);
}

export interface SleepRow {
  label: string;
  /** Mean urges per night for the nights in this bucket. */
  average: number;
  nights: number;
}

/**
 * Three buckets rather than five: with real data, finer slices leave some rows
 * standing on one or two nights, which reads as signal when it isn't.
 */
const SLEEP_BUCKETS: [label: string, lo: number, hi: number][] = [
  ["<6h", 0, 6],
  ["6–7.5h", 6, 7.5],
  ["7.5h+", 7.5, Infinity],
];

export function buildSleepRows(days: Days, now = new Date()): SleepRow[] {
  // Only nights whose sleep was actually recorded. Counting the rest at some
  // default would put a night the user never entered into a bucket and let it
  // pull that bucket's average around.
  const window = recorded(days, recentDates(CHART_WINDOW_DAYS, now)).filter(
    (d): d is Day & { sleep: number } => d.sleep !== null
  );
  return SLEEP_BUCKETS.map(([label, lo, hi]) => {
    const nights = window.filter((d) => d.sleep >= lo && d.sleep < hi);
    const urges = nights.reduce((sum, d) => sum + d.urges.length, 0);
    return { label, nights: nights.length, average: nights.length ? urges / nights.length : 0 };
  });
}
