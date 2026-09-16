import { DayEditor } from "./DayEditor.tsx";
import { useOverlay } from "../hooks/useOverlay.ts";
import { formatDate } from "../lib/date.ts";
import type { JournalApi } from "../hooks/useJournal.ts";
import type { Day, Urge } from "../types.ts";

interface ReaderOverlayProps {
  day: Day;
  journal: JournalApi;
  onClose: () => void;
  onEditUrge: (urge: Urge) => void;
  onLogUrge: () => void;
}

/**
 * A past day, opened from the archive.
 *
 * It reads as a page rather than a form — the writing keeps the same serif at
 * the same size it has everywhere else — but it is the day itself, not a
 * printout of it, so a typo can be fixed and a mis-logged urge corrected.
 */
export function ReaderOverlay({ day, journal, onClose, onEditUrge, onLogUrge }: ReaderOverlayProps) {
  const ref = useOverlay<HTMLDivElement>(onClose);

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

        <DayEditor
          day={day}
          habits={journal.habits}
          timelineLabel="Urges this day"
          placeholder="No writing this day."
          onPatch={(patch) => journal.patchDay(day.date, patch)}
          onToggleHabit={(habit) => journal.toggleHabit(day.date, habit)}
          onAddHabit={journal.addHabit}
          onRemoveHabit={journal.removeHabit}
          onAdjustSleep={(delta) => journal.adjustSleep(day.date, delta)}
          onEditUrge={onEditUrge}
        />

        {/* The floating button logs against today, and is hidden behind this
            overlay anyway. An urge remembered late belongs to the day it
            happened on, so it gets added from that day. */}
        <button type="button" className="reader-log" onClick={onLogUrge}>
          Log an urge on this day
        </button>
      </div>
    </div>
  );
}
