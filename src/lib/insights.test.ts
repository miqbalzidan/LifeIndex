import { describe, expect, it } from "vitest";
import { day, daysBefore, journalOf, urge } from "../../test/factory.ts";
import { CHART_WINDOW_DAYS, CLEAN_WINDOW_DAYS } from "./constants.ts";
import {
  buildHourHistogram,
  buildMoodSeries,
  buildSleepRows,
  countCleanDays,
  hourNote,
} from "./insights.ts";

const NOW = new Date(2026, 8, 9);
const gaveIn = () => urge({ outcome: "gave" });
const rodeOut = () => urge({ outcome: "rode" });

/**
 * These are the constraints from the brief, not incidental behaviour. The
 * headline is a share of a fixed window and must never behave like a streak.
 */
describe("countCleanDays", () => {
  it("counts every calendar day in the window, including untouched ones", () => {
    expect(countCleanDays({}, NOW)).toBe(CLEAN_WINDOW_DAYS);
  });

  it("does not count attendance: writing without urges changes nothing", () => {
    const written = journalOf(day(daysBefore(0, NOW), { text: "wrote something" }));
    expect(countCleanDays(written, NOW)).toBe(CLEAN_WINDOW_DAYS);
  });

  it("treats a day you rode out as clean", () => {
    const days = journalOf(day(daysBefore(3, NOW), { urges: [rodeOut(), rodeOut()] }));
    expect(countCleanDays(days, NOW)).toBe(CLEAN_WINDOW_DAYS);
  });

  it("costs exactly one day for a day you gave in", () => {
    const days = journalOf(day(daysBefore(3, NOW), { urges: [gaveIn()] }));
    expect(countCleanDays(days, NOW)).toBe(CLEAN_WINDOW_DAYS - 1);
  });

  it("costs one day however many times you gave in that day", () => {
    const days = journalOf(
      day(daysBefore(3, NOW), { urges: [gaveIn(), gaveIn(), gaveIn(), rodeOut()] })
    );
    expect(countCleanDays(days, NOW)).toBe(CLEAN_WINDOW_DAYS - 1);
  });

  it("never resets: a bad day does not erase the clean days around it", () => {
    // The failure this guards against is a streak counter, which would report
    // 0 here, or at best the length of the run since the last bad day.
    const days = journalOf(
      day(daysBefore(1, NOW), { urges: [gaveIn()] }),
      day(daysBefore(15, NOW), { urges: [gaveIn()] }),
      day(daysBefore(28, NOW), { urges: [gaveIn()] })
    );
    expect(countCleanDays(days, NOW)).toBe(CLEAN_WINDOW_DAYS - 3);
  });

  it("keeps a single clean day visible in an otherwise bad month", () => {
    const everyDay = Array.from({ length: CLEAN_WINDOW_DAYS }, (_, i) =>
      day(daysBefore(i, NOW), { urges: [gaveIn()] })
    );
    expect(countCleanDays(journalOf(...everyDay), NOW)).toBe(0);

    const oneGoodDay = everyDay.map((d, i) => (i === 10 ? day(d.date) : d));
    expect(countCleanDays(journalOf(...oneGoodDay), NOW)).toBe(1);
  });

  it("ignores days that have fallen out of the window", () => {
    const lastDayInside = day(daysBefore(CLEAN_WINDOW_DAYS - 1, NOW), { urges: [gaveIn()] });
    const firstDayOutside = day(daysBefore(CLEAN_WINDOW_DAYS, NOW), { urges: [gaveIn()] });

    expect(countCleanDays(journalOf(lastDayInside), NOW)).toBe(CLEAN_WINDOW_DAYS - 1);
    expect(countCleanDays(journalOf(firstDayOutside), NOW)).toBe(CLEAN_WINDOW_DAYS);
  });
});

describe("buildHourHistogram", () => {
  it("is empty and makes no claim when nothing has been logged", () => {
    const hist = buildHourHistogram({}, NOW);
    expect(hist.counts).toHaveLength(24);
    expect(hist.total).toBe(0);
    expect(hist.peakHour).toBe(-1);
    expect(hist.lateShare).toBe(0);
    expect(hourNote(hist)).toBe("");
  });

  it("buckets urges into the hour they happened in", () => {
    const days = journalOf(
      day(daysBefore(1, NOW), {
        urges: [urge({ t: 0 }), urge({ t: 59 }), urge({ t: 23 * 60 + 59 }), urge({ t: 9 * 60 })],
      })
    );
    const hist = buildHourHistogram(days, NOW);
    expect(hist.counts[0]).toBe(2);
    expect(hist.counts[9]).toBe(1);
    expect(hist.counts[23]).toBe(1);
    expect(hist.total).toBe(4);
    expect(hist.peakHour).toBe(0);
  });

  it("counts the late window as 9pm through 1:59am", () => {
    const late = [21, 22, 23, 0, 1].map((h) => urge({ t: h * 60 }));
    const notLate = [2, 20].map((h) => urge({ t: h * 60 }));
    const days = journalOf(day(daysBefore(1, NOW), { urges: [...late, ...notLate] }));
    expect(buildHourHistogram(days, NOW).lateShare).toBe(71); // 5 of 7
  });

  it("reads over the chart window, not the clean-days window", () => {
    const inside = day(daysBefore(CHART_WINDOW_DAYS - 1, NOW), { urges: [urge()] });
    const outside = day(daysBefore(CHART_WINDOW_DAYS, NOW), { urges: [urge()] });
    expect(buildHourHistogram(journalOf(inside), NOW).total).toBe(1);
    expect(buildHourHistogram(journalOf(inside, outside), NOW).total).toBe(1);
  });
});

describe("buildMoodSeries", () => {
  it("runs oldest to newest across the whole window", () => {
    const series = buildMoodSeries(
      journalOf(day(daysBefore(0, NOW), { mood: 5 }), day(daysBefore(29, NOW), { mood: 1 })),
      NOW
    );
    expect(series).toHaveLength(CLEAN_WINDOW_DAYS);
    expect(series[0]).toBe(1);
    expect(series[CLEAN_WINDOW_DAYS - 1]).toBe(5);
  });

  it("leaves a gap rather than inventing a mood for a day with none", () => {
    const series = buildMoodSeries(journalOf(day(daysBefore(5, NOW), { text: "no mood set" })), NOW);
    expect(series.every((m) => m === null)).toBe(true);
  });
});

describe("buildSleepRows", () => {
  it("reports three buckets in a stable order, even with no nights", () => {
    const rows = buildSleepRows({}, NOW);
    expect(rows.map((r) => r.label)).toEqual(["<6h", "6–7.5h", "7.5h+"]);
    expect(rows.every((r) => r.nights === 0 && r.average === 0)).toBe(true);
  });

  it("puts each bucket boundary on the expected side", () => {
    const nights = [5.9, 6, 7.4, 7.5, 12].map((sleep, i) =>
      day(daysBefore(i, NOW), { sleep, urges: [urge()] })
    );
    const rows = buildSleepRows(journalOf(...nights), NOW);
    expect(rows.map((r) => r.nights)).toEqual([1, 2, 2]);
  });

  it("averages urges over the nights in the bucket", () => {
    const nights = journalOf(
      day(daysBefore(0, NOW), { sleep: 5, urges: [urge(), urge(), urge()] }),
      day(daysBefore(1, NOW), { sleep: 5, urges: [urge()] }),
      day(daysBefore(2, NOW), { sleep: 9, urges: [] })
    );
    const rows = buildSleepRows(nights, NOW);
    expect(rows[0]).toMatchObject({ label: "<6h", nights: 2, average: 2 });
    expect(rows[2]).toMatchObject({ label: "7.5h+", nights: 1, average: 0 });
  });
});
