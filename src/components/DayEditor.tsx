import { useEffect, useRef } from "react";
import { HabitRow } from "./HabitRow.tsx";
import { Scale } from "./Scale.tsx";
import { SLEEP_MAX, SLEEP_MIN, SLEEP_STEP } from "../lib/constants.ts";
import { formatTime } from "../lib/date.ts";
import { plural, sleepLabel, urgeLine, wordCount } from "../lib/format.ts";
import type { Day, Urge } from "../types.ts";

/** Editor floor, matching the design's `min-height`. */
const MIN_EDITOR_HEIGHT = 150;

interface DayEditorProps {
  day: Day;
  /** Heading over the timeline — "Today's urges" reads wrong on a Tuesday in March. */
  timelineLabel: string;
  placeholder: string;
  /** The journal's habit list — what is on offer, in order. */
  habits: string[];
  onPatch: (patch: Partial<Omit<Day, "date">>) => void;
  onToggleHabit: (habit: string) => void;
  onAddHabit: (name: string) => string | null;
  onRemoveHabit: (habit: string) => void;
  onAdjustSleep: (delta: number) => void;
  onEditUrge: (urge: Urge) => void;
}

/**
 * One day, open for writing: the entry, its urges, and the measures under it.
 *
 * Shared by Today and by the reader. A day you wrote three months ago is the
 * same kind of thing as tonight's, and being unable to fix a typo in it — or to
 * correct an urge logged in the wrong minute — is a property of the storage,
 * not a decision anyone made.
 */
export function DayEditor({
  day,
  habits,
  timelineLabel,
  placeholder,
  onPatch,
  onToggleHabit,
  onAddHabit,
  onRemoveHabit,
  onAdjustSleep,
  onEditUrge,
}: DayEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Grow the editor to fit its content instead of scrolling inside itself — the
  // page scrolls, the writing surface just gets taller.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(MIN_EDITOR_HEIGHT, el.scrollHeight)}px`;
  }, [day.text, day.date]);

  const words = wordCount(day.text);

  return (
    <>
      <textarea
        ref={editorRef}
        className="editor"
        value={day.text}
        onChange={(e) => onPatch({ text: e.target.value })}
        placeholder={placeholder}
        aria-label="Entry"
        rows={4}
      />

      <div className="word-count" aria-live="off">
        {words ? `${words} ${plural(words, "word")}` : ""}
      </div>

      {day.urges.length > 0 && (
        <section className="timeline">
          <h2 className="timeline-label">{timelineLabel}</h2>
          {day.urges.map((u) => (
            <button
              key={u.id}
              type="button"
              className="timeline-item"
              onClick={() => onEditUrge(u)}
              aria-label={`Open the urge logged at ${formatTime(u.t)}`}
            >
              <span className="timeline-dot" aria-hidden="true" />
              <span className="timeline-head">
                <span className="timeline-time">{formatTime(u.t)}</span>
                <span className="timeline-trigger">{u.trigger}</span>
                <span className="timeline-level">{u.level}/5</span>
              </span>
              <span className="timeline-line">{urgeLine(u)}</span>
            </button>
          ))}
        </section>
      )}

      <hr className="rule" />

      <div className="measures">
        <div className="measure">
          <div className="measure-name">Mood</div>
          <Scale label="Mood" value={day.mood} onChange={(mood) => onPatch({ mood })} />
        </div>

        <div className="measure">
          <div className="measure-name">Energy</div>
          <Scale label="Energy" value={day.energy} onChange={(energy) => onPatch({ energy })} />
        </div>

        <div className="measure">
          <div className="measure-name">Sleep</div>
          <div className="stepper">
            <button
              type="button"
              className="stepper-button"
              onClick={() => onAdjustSleep(-SLEEP_STEP)}
              disabled={day.sleep !== null && day.sleep <= SLEEP_MIN}
              aria-label="Half an hour less sleep"
            >
              –
            </button>
            {/* Blank until it is actually recorded. Showing the default here
                would make a night nobody entered look like a night of seven
                hours, in the archive and in the sleep chart both. */}
            <div
              className={day.sleep === null ? "stepper-value stepper-value--unset" : "stepper-value"}
              aria-live="polite"
            >
              {day.sleep === null ? (
                <>
                  —<span className="sr-only">sleep not recorded</span>
                </>
              ) : (
                sleepLabel(day.sleep)
              )}
            </div>
            <button
              type="button"
              className="stepper-button"
              onClick={() => onAdjustSleep(SLEEP_STEP)}
              disabled={day.sleep !== null && day.sleep >= SLEEP_MAX}
              aria-label="Half an hour more sleep"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <HabitRow
        day={day}
        habits={habits}
        onToggle={onToggleHabit}
        onAdd={onAddHabit}
        onRemove={onRemoveHabit}
      />
    </>
  );
}
