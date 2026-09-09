import { useOverlay } from "../hooks/useOverlay.ts";
import { formatDate, formatTime } from "../lib/date.ts";
import { readerMeta, urgeDetail } from "../lib/format.ts";
import type { Day } from "../types.ts";

interface ReaderOverlayProps {
  day: Day;
  onClose: () => void;
}

export function ReaderOverlay({ day, onClose }: ReaderOverlayProps) {
  const ref = useOverlay<HTMLDivElement>(onClose);
  const text = day.text.trim();

  return (
    <div
      className="reader"
      role="dialog"
      aria-modal="true"
      aria-label="Entry"
      tabIndex={-1}
      ref={ref}
    >
      <div className="reader-inner">
        <button type="button" className="reader-back" onClick={onClose}>
          ← Archive
        </button>

        <h1 className="reader-date">
          {formatDate(day.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </h1>
        <div className="reader-meta">{readerMeta(day)}</div>

        <div className={text ? "reader-text" : "reader-text reader-text--absent"}>
          {text || "No writing this day."}
        </div>

        {day.urges.length > 0 && (
          <section className="reader-urges">
            {day.urges.map((u) => (
              <div key={u.id} className="reader-urge">
                <span className="reader-urge-time">{formatTime(u.t)}</span>
                <span>{urgeDetail(u)}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
