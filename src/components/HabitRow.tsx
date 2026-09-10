import { useState } from "react";
import { habitsForDay } from "../lib/habits.ts";
import type { Day } from "../types.ts";

interface HabitRowProps {
  day: Day;
  /** The journal's habit list — what is on offer, in order. */
  habits: string[];
  onToggle: (habit: string) => void;
  onAdd: (name: string) => string | null;
  onRemove: (habit: string) => void;
}

/**
 * The habits for one day, and the way to change which habits exist.
 *
 * Editing is one panel behind one typographic control rather than a mode the
 * row drops into: adding and removing are the same errand, and doing both in
 * one place keeps the row itself a row of chips.
 */
export function HabitRow({ day, habits, onToggle, onAdd, onRemove }: HabitRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // A habit dropped from the list still shows on a day that recorded it.
  const shown = habitsForDay(habits, day);

  const submit = () => {
    const reason = onAdd(draft);
    if (reason) {
      setError(reason);
      return;
    }
    setDraft("");
    setError(null);
  };

  return (
    <>
      <div className="habits">
        {shown.map((habit) => (
          <button
            key={habit}
            type="button"
            className="habit"
            aria-pressed={day.habits.includes(habit)}
            onClick={() => onToggle(habit)}
          >
            <span className="habit-dot" aria-hidden="true" />
            {habit}
          </button>
        ))}

        <button
          type="button"
          className="habit-edit"
          aria-expanded={editing}
          onClick={() => {
            setEditing((open) => !open);
            setError(null);
          }}
        >
          {editing ? "done" : "edit"}
          <span className="sr-only"> the habits on offer</span>
        </button>
      </div>

      {editing && (
        <div className="habit-editor">
          {habits.length > 0 ? (
            <ul className="habit-list">
              {habits.map((habit) => (
                <li key={habit} className="habit-list-item">
                  <span>{habit}</span>
                  <button
                    type="button"
                    className="habit-remove"
                    onClick={() => onRemove(habit)}
                  >
                    remove
                    <span className="sr-only"> {habit}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="quiet-note habit-empty">No habits yet. Name one below.</p>
          )}

          <form
            className="habit-add"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="habit-input"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              placeholder="Name a habit"
              aria-label="Name a habit"
            />
            <button type="submit" className="habit-submit">
              Add
            </button>
          </form>

          {error && (
            <p className="habit-error" role="status">
              {error}
            </p>
          )}

          {/* Removing a habit is about what to track from here, so it says what
              it does not do. */}
          <p className="habit-note">Removing one leaves it on the days it was already ticked.</p>
        </div>
      )}
    </>
  );
}
