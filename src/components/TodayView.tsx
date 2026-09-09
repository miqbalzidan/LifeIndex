import { useEffect, useRef } from "react";
import { Scale } from "./Scale.tsx";
import { HABITS, PROMPTS, SLEEP_MAX, SLEEP_MIN, SLEEP_STEP } from "../lib/constants.ts";
import { formatDate, formatTime, fromIso } from "../lib/date.ts";
import { plural, sleepLabel, urgeLine, wordCount } from "../lib/format.ts";
import type { JournalApi } from "../hooks/useJournal.ts";

/** Editor floor, matching the design's `min-height`. */
const MIN_EDITOR_HEIGHT = 150;

interface TodayViewProps {
  journal: JournalApi;
}

export function TodayView({ journal }: TodayViewProps) {
  const { today, todayDate, promptSkips, patchToday, toggleHabit, adjustSleep, skipPrompt } = journal;
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Grow the editor to fit its content instead of scrolling inside itself — the
  // page scrolls, the writing surface just gets taller.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(MIN_EDITOR_HEIGHT, el.scrollHeight)}px`;
  }, [today.text]);

  const words = wordCount(today.text);

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

      <textarea
        ref={editorRef}
        className="editor"
        value={today.text}
        onChange={(e) => patchToday({ text: e.target.value })}
        placeholder="Write as much or as little as you like."
        aria-label="Today's entry"
        rows={4}
      />

      <div className="word-count" aria-live="off">
        {words ? `${words} ${plural(words, "word")}` : ""}
      </div>

      {today.urges.length > 0 && (
        <section className="timeline">
          <h2 className="timeline-label">Today's urges</h2>
          {today.urges.map((u) => (
            <div key={u.id} className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-head">
                <span className="timeline-time">{formatTime(u.t)}</span>
                <span className="timeline-trigger">{u.trigger}</span>
                <span className="timeline-level">{u.level}/5</span>
              </div>
              <p className="timeline-line">{urgeLine(u)}</p>
            </div>
          ))}
        </section>
      )}

      <hr className="rule" />

      <div className="measures">
        <div className="measure">
          <div className="measure-name">Mood</div>
          <Scale label="Mood" value={today.mood} onChange={(mood) => patchToday({ mood })} />
        </div>

        <div className="measure">
          <div className="measure-name">Energy</div>
          <Scale label="Energy" value={today.energy} onChange={(energy) => patchToday({ energy })} />
        </div>

        <div className="measure">
          <div className="measure-name">Sleep</div>
          <div className="stepper">
            <button
              type="button"
              className="stepper-button"
              onClick={() => adjustSleep(-SLEEP_STEP)}
              disabled={today.sleep <= SLEEP_MIN}
              aria-label="Half an hour less sleep"
            >
              –
            </button>
            <div className="stepper-value" aria-live="polite">
              {sleepLabel(today.sleep)}
            </div>
            <button
              type="button"
              className="stepper-button"
              onClick={() => adjustSleep(SLEEP_STEP)}
              disabled={today.sleep >= SLEEP_MAX}
              aria-label="Half an hour more sleep"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="habits">
        {HABITS.map((habit) => (
          <button
            key={habit}
            type="button"
            className="habit"
            aria-pressed={today.habits.includes(habit)}
            onClick={() => toggleHabit(habit)}
          >
            <span className="habit-dot" aria-hidden="true" />
            {habit}
          </button>
        ))}
      </div>
    </div>
  );
}
