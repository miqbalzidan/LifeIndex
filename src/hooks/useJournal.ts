import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blankDay, dayHasContent, loadJournal, saveJournal } from "../lib/storage.ts";
import { DEFAULT_SLEEP, SLEEP_MAX, SLEEP_MIN } from "../lib/constants.ts";
import { todayIso } from "../lib/date.ts";
import type { Day, Journal, Urge } from "../types.ts";

/** Keystrokes shouldn't each cost a full serialise-and-write of the archive. */
const SAVE_DEBOUNCE_MS = 400;

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * The date the app considers "today".
 *
 * Recomputed when the app is reopened or brought back to the foreground, but
 * deliberately *not* on a midnight timer: a session left open while you are
 * writing should not empty the editor under your hands at 00:00. A night's
 * writing belongs to the night it started.
 */
function useCurrentDate(): string {
  const [date, setDate] = useState(todayIso);

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") setDate(todayIso());
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return date;
}

export interface JournalApi {
  days: Record<string, Day>;
  /** The whole journal, for export. */
  journal: Journal;
  today: Day;
  todayDate: string;
  promptSkips: number;
  patchToday: (patch: Partial<Omit<Day, "date">>) => void;
  toggleHabit: (habit: string) => void;
  adjustSleep: (delta: number) => void;
  logUrge: (draft: Omit<Urge, "id">) => void;
  skipPrompt: () => void;
  replaceJournal: (next: Journal) => void;
}

export function useJournal(): JournalApi {
  const todayDate = useCurrentDate();
  const [journal, setJournal] = useState<Journal>(loadJournal);

  // Persist on a trailing debounce, and once more on the way out so a fast
  // close (or a backgrounded tab the OS then kills) can't drop the last edit.
  const latest = useRef(journal);
  latest.current = journal;

  useEffect(() => {
    const timer = window.setTimeout(() => saveJournal(journal), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [journal]);

  useEffect(() => {
    const flush = () => saveJournal(latest.current);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const today = useMemo(
    () => journal.days[todayDate] ?? blankDay(todayDate),
    [journal.days, todayDate]
  );

  /**
   * Rewrites today through `change`, then drops the day again if that leaves it
   * with nothing in it — merely opening the app on a day you didn't use should
   * not put a blank row in the archive.
   */
  const updateToday = useCallback(
    (change: (day: Day) => Day) => {
      setJournal((prev) => {
        const next = { ...change(prev.days[todayDate] ?? blankDay(todayDate)), date: todayDate };
        const days = { ...prev.days };
        if (dayHasContent(next)) days[todayDate] = next;
        else delete days[todayDate];
        return { ...prev, days };
      });
    },
    [todayDate]
  );

  const patchToday = useCallback(
    (patch: Partial<Omit<Day, "date">>) => updateToday((day) => ({ ...day, ...patch })),
    [updateToday]
  );

  const toggleHabit = useCallback(
    (habit: string) =>
      updateToday((day) => ({
        ...day,
        habits: day.habits.includes(habit)
          ? day.habits.filter((h) => h !== habit)
          : [...day.habits, habit],
      })),
    [updateToday]
  );

  const adjustSleep = useCallback(
    (delta: number) =>
      updateToday((day) => ({
        ...day,
        // From unrecorded, the first press writes down the default rather than
        // stepping away from it: about seven hours is the common night, and it
        // shouldn't take two presses to record. After that it steps, re-rounded
        // to the half hour so repeated presses can't accumulate float drift.
        sleep:
          day.sleep === null
            ? DEFAULT_SLEEP
            : Math.max(SLEEP_MIN, Math.min(SLEEP_MAX, Math.round((day.sleep + delta) * 2) / 2)),
      })),
    [updateToday]
  );

  const logUrge = useCallback(
    (draft: Omit<Urge, "id">) =>
      updateToday((day) => ({
        ...day,
        urges: [...day.urges, { ...draft, id: newId() }].sort((a, b) => a.t - b.t),
      })),
    [updateToday]
  );

  const skipPrompt = useCallback(() => {
    setJournal((prev) => ({ ...prev, promptSkips: prev.promptSkips + 1 }));
  }, []);

  // Persisted by the same debounce as everything else; an import is just a
  // large edit.
  const replaceJournal = useCallback((next: Journal) => setJournal(next), []);

  return {
    days: journal.days,
    journal,
    today,
    todayDate,
    promptSkips: journal.promptSkips,
    patchToday,
    toggleHabit,
    adjustSleep,
    logUrge,
    skipPrompt,
    replaceJournal,
  };
}
