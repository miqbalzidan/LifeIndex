import { DayEditor } from "./DayEditor.tsx";
import { PROMPTS } from "../lib/constants.ts";
import { formatDate, fromIso } from "../lib/date.ts";
import type { JournalApi } from "../hooks/useJournal.ts";
import type { Urge } from "../types.ts";

interface TodayViewProps {
  journal: JournalApi;
  onEditUrge: (urge: Urge) => void;
}

export function TodayView({ journal, onEditUrge }: TodayViewProps) {
  const { today, todayDate, promptSkips, patchDay, toggleHabit, adjustSleep, skipPrompt } =
    journal;

  // The prompt rotates with the day and again each time it's skipped, so it
  // isn't the same question waiting every night.
  const dayNumber = Math.floor(fromIso(todayDate).getTime() / 86_400_000);
  const prompt = PROMPTS[(((dayNumber + promptSkips) % PROMPTS.length) + PROMPTS.length) % PROMPTS.length];

  // The prompt is a suggestion, so it steps aside the moment there is writing
  // on the page and never asks to be dismissed.
  const showPrompt = today.text.trim() === "";

  return (
    <div className="screen">
      <header className="today-head">
        <div className="today-weekday">{formatDate(todayDate, { weekday: "long" })}</div>
        <h1 className="today-date">{formatDate(todayDate, { month: "long", day: "numeric" })}</h1>
      </header>

      {showPrompt && prompt && (
        <div className="prompt-row">
          <p className="prompt-text">{prompt}</p>
          <button type="button" className="prompt-skip" onClick={skipPrompt}>
            skip
            <span className="sr-only"> this writing prompt</span>
          </button>
        </div>
      )}

      <DayEditor
        day={today}
        habits={journal.habits}
        timelineLabel="Today's urges"
        placeholder="Write as much or as little as you like."
        onPatch={(patch) => patchDay(todayDate, patch)}
        onToggleHabit={(habit) => toggleHabit(todayDate, habit)}
        onAddHabit={journal.addHabit}
        onRemoveHabit={journal.removeHabit}
        onAdjustSleep={(delta) => adjustSleep(todayDate, delta)}
        onEditUrge={onEditUrge}
      />
    </div>
  );
}
