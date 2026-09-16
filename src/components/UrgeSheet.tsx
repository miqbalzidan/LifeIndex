import { useState } from "react";
import { Scale } from "./Scale.tsx";
import { useOverlay } from "../hooks/useOverlay.ts";
import { BACKFILL_TIME, TRIGGERS } from "../lib/constants.ts";
import { formatEntryDate, fromTimeInput, minutesNow, toTimeInput } from "../lib/date.ts";
import type { Outcome, Rating, Urge } from "../types.ts";

interface UrgeSheetProps {
  /** The day this urge belongs to. Not always today — a missed one can be
   *  written up later, from that day in the archive. */
  date: string;
  /** Today, so the sheet can say which day it is writing to when it isn't. */
  todayDate: string;
  /** The urge being changed, when this is an edit rather than a new log. */
  editing?: Urge;
  onClose: () => void;
  onSave: (urge: Omit<Urge, "id">) => void;
  /** Only offered while editing; there is nothing to delete on a new one. */
  onDelete?: () => void;
}

export function UrgeSheet({ date, todayDate, editing, onClose, onSave, onDelete }: UrgeSheetProps) {
  const ref = useOverlay<HTMLDivElement>(onClose);

  const [level, setLevel] = useState<Rating>(editing?.level ?? 3);
  const [trigger, setTrigger] = useState<string | null>(editing?.trigger ?? null);
  const [note, setNote] = useState(editing?.note ?? "");
  const [alt, setAlt] = useState(editing?.alt ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Stamped when the sheet opens: the urge happened when you reached for this,
  // not whenever you finished writing it up. An edit opens on the minute it was
  // logged at rather than moving it to now. Either way it can be corrected —
  // noticing an urge and writing it up are not always the same moment, and a
  // remembered time is better than no record.
  const [at, setAt] = useState(
    () => editing?.t ?? (date === todayDate ? minutesNow() : BACKFILL_TIME)
  );

  const save = (outcome: Outcome) => {
    onSave({
      t: at,
      level,
      trigger: trigger ?? "other",
      note: note.trim(),
      alt: alt.trim(),
      outcome,
    });
  };

  return (
    <div className="sheet-layer">
      {/* Tap-to-dismiss, but not a control in its own right: Escape and the
          explicit button below already cover this, and exposing the scrim as a
          third button just duplicates them in the accessibility tree. */}
      <div className="sheet-scrim" aria-hidden="true" onClick={onClose} />

      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="sheet-head">
          <h2 className="sheet-title" id="sheet-title">
            {editing ? "Edit urge" : "Log an urge"}
          </h2>
          <div className="sheet-when">
            {date !== todayDate && <div className="sheet-day">{formatEntryDate(date)}</div>}
            <input
              type="time"
              className="sheet-time"
              value={toTimeInput(at)}
              onChange={(e) => {
                const mins = fromTimeInput(e.target.value);
                // An empty or half-typed field leaves the last good time alone
                // rather than snapping the urge to midnight.
                if (mins !== null) setAt(mins);
              }}
              aria-label="Time"
            />
          </div>
        </div>

        <div className="sheet-field">
          <div className="sheet-field-label">Intensity</div>
          <div className="sheet-field-body">
            <Scale label="Intensity" value={level} onChange={setLevel} tall />
          </div>
        </div>

        <div className="sheet-field">
          <div className="sheet-field-label" id="sheet-trigger-label">
            Trigger
          </div>
          <div className="sheet-field-body chips" role="group" aria-labelledby="sheet-trigger-label">
            {TRIGGERS.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={trigger === name}
                onClick={() => setTrigger((prev) => (prev === name ? null : name))}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-lines">
          <input
            className="sheet-line"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was going on?"
            aria-label="What was going on?"
          />
          <input
            className="sheet-line"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="What you did instead"
            aria-label="What you did instead"
          />
        </div>

        {/* Both outcomes are the same size and the same colour. Logging either
            one is the same act: you noticed, and you wrote it down. */}
        <div className="sheet-actions">
          <button type="button" className="sheet-action" onClick={() => save("rode")}>
            Rode it out
          </button>
          <button type="button" className="sheet-action" onClick={() => save("gave")}>
            Gave in
          </button>
        </div>

        {onDelete &&
          (confirmingDelete ? (
            <div className="sheet-confirm">
              <span className="sheet-confirm-text">Delete this urge?</span>
              <button type="button" className="sheet-dismiss sheet-dismiss--inline" onClick={onDelete}>
                Delete
              </button>
              <button
                type="button"
                className="sheet-dismiss sheet-dismiss--inline"
                onClick={() => setConfirmingDelete(false)}
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="sheet-dismiss"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete this urge
            </button>
          ))}

        <button type="button" className="sheet-dismiss" onClick={onClose}>
          Close without saving
        </button>
      </div>
    </div>
  );
}
