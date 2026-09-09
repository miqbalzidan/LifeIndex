import { useMemo } from "react";
import { formatDate, formatEntryDate, monthsAgoIso } from "../lib/date.ts";
import { entryMeta, plural, snippet } from "../lib/format.ts";
import type { Day } from "../types.ts";

interface ArchiveViewProps {
  days: Record<string, Day>;
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (date: string) => void;
}

const ON_THIS_DAY = [
  { months: 1, label: "One month ago" },
  { months: 12, label: "One year ago" },
];

export function ArchiveView({ days, query, onQueryChange, onOpen }: ArchiveViewProps) {
  const q = query.trim().toLowerCase();

  // Reverse-chronological, and only days that hold something worth reading back.
  const entries = useMemo(() => {
    const written = Object.values(days)
      .filter((d) => d.text.trim() !== "" || d.urges.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    return q ? written.filter((d) => d.text.toLowerCase().includes(q)) : written;
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
        <h1 className="page-title">Archive</h1>
      </header>

      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search entries"
        aria-label="Search entries"
      />

      {/* Hidden while searching — it belongs to the archive at rest, not to a
          result set. */}
      {onThisDay.length > 0 && !q && (
        <section className="on-this-day">
          <h2 className="on-this-day-label">On this day</h2>
          {onThisDay.map(({ label, day }) => (
            <div key={day.date} className="on-this-day-item">
              <div className="on-this-day-meta">
                {label} · {formatDate(day.date, { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <p className="on-this-day-snippet">{snippet(day.text, 150)}</p>
            </div>
          ))}
        </section>
      )}

      <div className="entries">
        {entries.map((day) => (
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
        {entries.length === 0 && (
          <p className="quiet-note entries-empty">
            {hasAnything
              ? "Nothing here for that word. Try another."
              : "Nothing here yet. What you write will collect on this page."}
          </p>
        )}
      </div>
    </div>
  );
}
