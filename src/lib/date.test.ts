import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatEntryDate,
  formatTime,
  fromIso,
  minutesNow,
  monthsAgoIso,
  recentDates,
  todayIso,
  toIso,
} from "./date.ts";

/** Runs `fn` with the process in `tz`, then puts the old zone back. */
function inZone<T>(tz: string, fn: () => T): T {
  const previous = process.env["TZ"];
  process.env["TZ"] = tz;
  try {
    return fn();
  } finally {
    process.env["TZ"] = previous;
  }
}

describe("toIso", () => {
  it("pads month and day to two digits", () => {
    expect(toIso(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toIso(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("keeps a late-evening entry on its own night, west of Greenwich", () => {
    inZone("America/Los_Angeles", () => {
      const lateNight = new Date(2026, 8, 9, 23, 30);
      expect(toIso(lateNight)).toBe("2026-09-09");
      // The whole reason this function exists rather than using toISOString:
      // that would have filed this entry under tomorrow.
      expect(lateNight.toISOString().slice(0, 10)).toBe("2026-09-10");
    });
  });

  it("keeps an early-morning entry on its own day, east of Greenwich", () => {
    inZone("Asia/Tokyo", () => {
      const earlyMorning = new Date(2026, 8, 9, 0, 30);
      expect(toIso(earlyMorning)).toBe("2026-09-09");
      expect(earlyMorning.toISOString().slice(0, 10)).toBe("2026-09-08");
    });
  });
});

describe("fromIso", () => {
  it("parses to local midnight, not UTC midnight", () => {
    inZone("America/Los_Angeles", () => {
      const d = fromIso("2026-09-09");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(8);
      expect(d.getDate()).toBe(9);
      expect(d.getHours()).toBe(0);
      // Date.parse of the same string lands on the previous local day here.
      expect(new Date(Date.parse("2026-09-09")).getDate()).toBe(8);
    });
  });

  it("round-trips with toIso in every zone we care about", () => {
    for (const tz of ["America/Los_Angeles", "UTC", "Asia/Tokyo", "Pacific/Kiritimati"]) {
      inZone(tz, () => {
        for (const iso of ["2026-01-01", "2026-02-28", "2026-07-04", "2026-12-31"]) {
          expect(toIso(fromIso(iso))).toBe(iso);
        }
      });
    }
  });
});

describe("todayIso and minutesNow", () => {
  it("reads the clock it is given", () => {
    expect(todayIso(new Date(2026, 8, 9, 22, 14))).toBe("2026-09-09");
    expect(minutesNow(new Date(2026, 8, 9, 22, 14))).toBe(22 * 60 + 14);
    expect(minutesNow(new Date(2026, 8, 9, 0, 0))).toBe(0);
    expect(minutesNow(new Date(2026, 8, 9, 23, 59))).toBe(1439);
  });
});

describe("recentDates", () => {
  const now = new Date(2026, 8, 9);

  it("returns the window most recent first, starting with today", () => {
    const dates = recentDates(30, now);
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe("2026-09-09");
    expect(dates[29]).toBe("2026-08-11");
  });

  it("returns consecutive, distinct calendar days", () => {
    const dates = recentDates(30, now);
    expect(new Set(dates).size).toBe(30);
    for (let i = 1; i < dates.length; i++) {
      const gap = fromIso(dates[i - 1]!).getTime() - fromIso(dates[i]!).getTime();
      expect(Math.round(gap / 3_600_000)).toBe(24);
    }
  });

  it("crosses month and year boundaries", () => {
    expect(recentDates(5, new Date(2026, 0, 2))).toEqual([
      "2026-01-02",
      "2026-01-01",
      "2025-12-31",
      "2025-12-30",
      "2025-12-29",
    ]);
  });

  it("neither skips nor repeats a day across a DST transition", () => {
    // Spring forward (2026-03-08) and fall back (2026-11-01) in US Pacific.
    // Arithmetic on timestamps rather than calendar fields drops or doubles a
    // day here; these windows are built from local components instead.
    for (const [label, anchor] of [
      ["spring forward", new Date(2026, 2, 14)],
      ["fall back", new Date(2026, 10, 7)],
    ] as const) {
      inZone("America/Los_Angeles", () => {
        const dates = recentDates(14, anchor);
        expect(dates, label).toHaveLength(14);
        expect(new Set(dates).size, label).toBe(14);
      });
    }
    expect(recentDates(14, new Date(2026, 2, 14))).toContain("2026-03-08");
    expect(recentDates(14, new Date(2026, 10, 7))).toContain("2026-11-01");
  });

  it("returns nothing for a window of zero", () => {
    expect(recentDates(0, now)).toEqual([]);
  });
});

describe("monthsAgoIso", () => {
  it("keeps the same day of the month in the ordinary case", () => {
    expect(monthsAgoIso(1, new Date(2026, 8, 9))).toBe("2026-08-09");
    expect(monthsAgoIso(12, new Date(2026, 8, 9))).toBe("2025-09-09");
  });

  it("clamps to the last day of a shorter month instead of rolling forward", () => {
    // Unclamped, `new Date(2026, 1, 31)` is March 3rd — which would label a
    // stranger's entry "one month ago".
    expect(monthsAgoIso(1, new Date(2026, 2, 31))).toBe("2026-02-28");
    expect(monthsAgoIso(1, new Date(2024, 2, 31))).toBe("2024-02-29");
    expect(monthsAgoIso(1, new Date(2026, 4, 31))).toBe("2026-04-30");
    expect(monthsAgoIso(1, new Date(2026, 6, 31))).toBe("2026-06-30");
  });

  it("clamps a leap day back to a non-leap year", () => {
    expect(monthsAgoIso(12, new Date(2024, 1, 29))).toBe("2023-02-28");
  });

  it("walks back into the previous year", () => {
    expect(monthsAgoIso(1, new Date(2026, 0, 15))).toBe("2025-12-15");
    expect(monthsAgoIso(12, new Date(2026, 0, 31))).toBe("2025-01-31");
  });
});

describe("formatTime", () => {
  it("reads as a lowercase 12-hour clock", () => {
    expect(formatTime(0)).toBe("12:00am");
    expect(formatTime(1)).toBe("12:01am");
    expect(formatTime(9 * 60 + 5)).toBe("9:05am");
    expect(formatTime(11 * 60 + 59)).toBe("11:59am");
    expect(formatTime(12 * 60)).toBe("12:00pm");
    expect(formatTime(13 * 60)).toBe("1:00pm");
    expect(formatTime(22 * 60 + 14)).toBe("10:14pm");
    expect(formatTime(1439)).toBe("11:59pm");
  });

  it("wraps rather than producing a 25th hour", () => {
    expect(formatTime(1440)).toBe("12:00am");
    expect(formatTime(1500)).toBe("1:00am");
    expect(formatTime(-60)).toBe("11:00pm");
  });
});

describe("formatEntryDate", () => {
  const now = new Date(2026, 8, 9);

  it("omits the year within the current year", () => {
    expect(formatEntryDate("2026-03-04", now)).not.toMatch(/2026/);
  });

  it("carries the year for an older entry, so two Septembers stay apart", () => {
    const older = formatEntryDate("2024-09-09", now);
    expect(older).toMatch(/2024/);
    expect(older).not.toBe(formatEntryDate("2026-09-09", now));
  });
});

describe("formatDate", () => {
  it("formats from the local calendar date, not a UTC instant", () => {
    inZone("America/Los_Angeles", () => {
      // 2026-09-09 is a Wednesday. Parsed as UTC it would render as Tuesday.
      expect(formatDate("2026-09-09", { weekday: "long" })).toBe("Wednesday");
    });
  });
});
