import { useState } from "react";
import { Scale } from "./Scale.tsx";
import { useOverlay } from "../hooks/useOverlay.ts";
import { TRIGGERS } from "../lib/constants.ts";
import { formatTime, minutesNow } from "../lib/date.ts";
import type { Outcome, Rating, Urge } from "../types.ts";

interface UrgeSheetProps {
  onClose: () => void;
  onSave: (urge: Omit<Urge, "id">) => void;
}

export function UrgeSheet({ onClose, onSave }: UrgeSheetProps) {
  const ref = useOverlay<HTMLDivElement>(onClose);

  const [level, setLevel] = useState<Rating>(3);
  const [trigger, setTrigger] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [alt, setAlt] = useState("");

  // Stamped when the sheet opens, and saved as-is: the urge happened when you
  // reached for this, not whenever you finished writing it up.
  const [openedAt] = useState(() => minutesNow());

  const save = (outcome: Outcome) => {
    onSave({
      t: openedAt,
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
            Log an urge
          </h2>
          <div className="sheet-time">{formatTime(openedAt)}</div>
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

        <button type="button" className="sheet-dismiss" onClick={onClose}>
          Close without saving
        </button>
      </div>
    </div>
  );
}
