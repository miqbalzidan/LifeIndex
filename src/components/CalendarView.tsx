import { useMemo, useState } from "react";
import { JournalTransfer } from "./JournalTransfer.tsx";
import {
  formatDate,
  formatEntryDate,
  formatMonthLabel,
  monthGrid,
  monthsAgoIso,
  todayIso,
} from "../lib/date.ts";
import { entryMeta, plural, snippet } from "../lib/format.ts";
import type { JournalApi } from "../hooks/useJournal.ts";
import type { Day } from "../types.ts";

interface CalendarViewProps {
  journal: JournalApi;
  query: string;
  onQueryChange: (q: string) => void;
  /** Opens a day for reading or writing. The caller decides what "today"
   *  means here — this view just asks for a date. */
  onOpen: (date: string) => void;
}

const ON_THIS_DAY = [
  { months: 1, label: "One month ago" },
  { months: 12, label: "One year ago" },
];

/** Single letters read fine at this width; a name per column would not fit six. */
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** The day-of-month a `YYYY-MM-DD` string ends in, as a number. */
const dayOfMonth = (iso: string): number => Number(iso.slice(-2));

/**
 * The archive of the whole journal: a calendar by default, a search result
 * list once you start typing.
 *
 * A calendar is what makes a night you never wrote on reachable without
 * scrolling — every day in the month is one tap away, whether or not
 * anything is on it. Search stays for the case a calendar can't help with:
 * finding a word, not a date.
 */
export function CalendarView({ journal, query, onQueryChange, onOpen }: CalendarViewProps) {
  const { days } = journal;
  const q = query.trim().toLowerCase();
  const today = todayIso();

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const now = new Date();
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const monthLabel = useMemo(() => formatMonthLabel(cursor.year, cursor.month), [cursor]);

  const stepMonth = (delta: number) => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  // Reverse-chronological, and only days that hold something worth reading
  // back — the same rule the calendar's own dot uses.
  const searchResults = useMemo(() => {
    if (!q) return [];
    return Object.values(days)
      .filter((d) => d.text.trim() !== "" || d.urges.length > 0)
      .filter((d) => d.text.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [days, q]);

  const onThisDay = useMemo(
    () =>
      ON_THIS_DAY.map(({ months, label }) => {
        const date = monthsAgoIso(months);
        const day = days[date];
        return day && day.text.trim() ? { label, day } : null;
      }).filter((x): x is { label: string; day: Day } => x !== null),
    [days]
  );

  const hasAnything = Object.values(days).some((d) => d.text.trim() !== "" || d.urges.length > 0);

  return (
    <div className="screen">
      <header className="page-head">
        <h1 className="page-title">Calendar</h1>
      </header>

      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search entries"
        aria-label="Search entries"
      />

      {/* The fast path to a day the calendar isn't currently showing — a
          jump of a year, say, rather than twelve taps on "previous month".
          Kept near the top: this is what used to sit at the foot of the
          page, past everything else, which is the thing that made an old
          night hard to get to in the first place. */}
      <section className="reach">
        <label className="reach-label" htmlFor="reach-input">
          Jump to a day
        </label>
        <input
          id="reach-input"
          type="date"
          className="reach-input"
          max={today}
          value=""
          onChange={(e) => {
            if (e.target.value) onOpen(e.target.value);
          }}
        />
      </section>

      {q ? (
        <div className="entries">
          {searchResults.map((day) => (
            <button key={day.date} type="button" className="entry" onClick={() => onOpen(day.date)}>
              <span className="entry-head">
                <span className="entry-date">{formatEntryDate(day.date)}</span>
                <span className="entry-weekday">{formatDate(day.date, { weekday: "short" })}</span>
                <span className="entry-meta">{entryMeta(day)}</span>
              </span>
              <span className="entry-body">
                {day.text.trim()
                  ? snippet(day.text, 120)
                  : `No entry — ${day.urges.length} ${plural(day.urges.length, "urge")} logged.`}
              </span>
            </button>
          ))}

          {/* Two different silences: nothing written yet, and nothing matching.
              Neither one comments on how often you write. */}
          {searchResults.length === 0 && (
            <p className="quiet-note entries-empty">
              {hasAnything
                ? "Nothing here for that word. Try another."
                : "Nothing here yet. What you write will collect on this page."}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Hidden while searching — it belongs to the calendar at rest,
              not to a result set. */}
          {onThisDay.length > 0 && (
            <section className="on-this-day">
              <h2 className="on-this-day-label">On this day</h2>
              {onThisDay.map(({ label, day }) => (
                <div key={day.date} className="on-this-day-item">
                  <div className="on-this-day-meta">
                    {label} ·{" "}
                    {formatDate(day.date, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <p className="on-this-day-snippet">{snippet(day.text, 150)}</p>
                </div>
              ))}
            </section>
          )}

          <section className="calendar">
            <div className="calendar-head">
              <button
                type="button"
                className="calendar-nav"
                onClick={() => stepMonth(-1)}
                aria-label="Previous month"
              >
                ‹
              </button>
              <h2 className="calendar-month">{monthLabel}</h2>
              <button
                type="button"
                className="calendar-nav"
                onClick={() => stepMonth(1)}
                disabled={isCurrentMonth}
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="calendar-weekdays" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {grid.map((date, i) => {
                if (date === null) {
                  return <span key={i} className="calendar-cell calendar-cell--blank" aria-hidden="true" />;
                }

                const day = days[date];
                const hasContent = !!day && (day.text.trim() !== "" || day.urges.length > 0);
                const isToday = date === today;
                const isFuture = date > today;

                return (
                  <button
                    key={date}
                    type="button"
                    className={isToday ? "calendar-cell calendar-cell--today" : "calendar-cell"}
                    disabled={isFuture}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${formatEntryDate(date)}${hasContent ? ", entry logged" : ""}`}
                    onClick={() => onOpen(date)}
                  >
                    <span className="calendar-daynum">{dayOfMonth(date)}</span>
                    {hasContent && <span className="calendar-dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      <JournalTransfer journal={journal.journal} onImport={journal.replaceJournal} />
    </div>
  );
}
