import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blankDay, dayHasContent, loadJournal, saveJournal } from "../lib/storage.ts";
import { DEFAULT_SLEEP, SLEEP_MAX, SLEEP_MIN } from "../lib/constants.ts";
import { addHabit as addToList, removeHabit as removeFromList } from "../lib/habits.ts";
import {
  addTask as addToTasks,
  clearDone as clearDoneTasks,
  editTask as editInTasks,
  removeTask as removeFromTasks,
  toggleTask as toggleInTasks,
} from "../lib/tasks.ts";
import { todayIso } from "../lib/date.ts";
import type { Day, Journal, Task, Urge } from "../types.ts";

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

/**
 * Every mutation takes the date it applies to. The reader edits a past day
 * through exactly the same calls Today uses on the current one.
 */
export interface JournalApi {
  days: Record<string, Day>;
  /** The whole journal, for export. */
  journal: Journal;
  today: Day;
  todayDate: string;
  /** The habit list on offer, in the order it is shown. */
  habits: string[];
  /** The standing list of one-off tasks, in the order they were added. */
  tasks: Task[];
  promptSkips: number;
  patchDay: (date: string, patch: Partial<Omit<Day, "date">>) => void;
  toggleHabit: (date: string, habit: string) => void;
  adjustSleep: (date: string, delta: number) => void;
  logUrge: (date: string, draft: Omit<Urge, "id">) => void;
  updateUrge: (date: string, id: string, draft: Omit<Urge, "id">) => void;
  deleteUrge: (date: string, id: string) => void;
  skipPrompt: () => void;
  /** Returns why the habit was refused, or `null` once it is added. */
  addHabit: (name: string) => string | null;
  removeHabit: (habit: string) => void;
  /** Returns why the task was refused, or `null` once it is added. */
  addTask: (text: string) => string | null;
  toggleTask: (id: string) => void;
  editTask: (id: string, text: string) => void;
  removeTask: (id: string) => void;
  clearDoneTasks: () => void;
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
   * Rewrites one day through `change`, then drops it again if that leaves it
   * with nothing in it — merely opening the app on a day you didn't use should
   * not put a blank row in the archive, and deleting the last thing on a day
   * should take the row away again.
   */
  const updateDay = useCallback((date: string, change: (day: Day) => Day) => {
    setJournal((prev) => {
      const next = { ...change(prev.days[date] ?? blankDay(date)), date };
      const days = { ...prev.days };
      if (dayHasContent(next)) days[date] = next;
      else delete days[date];
      return { ...prev, days };
    });
  }, []);

  const patchDay = useCallback(
    (date: string, patch: Partial<Omit<Day, "date">>) =>
      updateDay(date, (day) => ({ ...day, ...patch })),
    [updateDay]
  );

  const toggleHabit = useCallback(
    (date: string, habit: string) =>
      updateDay(date, (day) => ({
        ...day,
        habits: day.habits.includes(habit)
          ? day.habits.filter((h) => h !== habit)
          : [...day.habits, habit],
      })),
    [updateDay]
  );

  const adjustSleep = useCallback(
    (date: string, delta: number) =>
      updateDay(date, (day) => ({
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
    [updateDay]
  );

  const logUrge = useCallback(
    (date: string, draft: Omit<Urge, "id">) =>
      updateDay(date, (day) => ({
        ...day,
        urges: [...day.urges, { ...draft, id: newId() }].sort((a, b) => a.t - b.t),
      })),
    [updateDay]
  );

  // Keeps the id, so an edit stays the same entry rather than becoming a new
  // one at the same time.
  const updateUrge = useCallback(
    (date: string, id: string, draft: Omit<Urge, "id">) =>
      updateDay(date, (day) => ({
        ...day,
        urges: day.urges
          .map((u) => (u.id === id ? { ...draft, id } : u))
          .sort((a, b) => a.t - b.t),
      })),
    [updateDay]
  );

  const deleteUrge = useCallback(
    (date: string, id: string) =>
      updateDay(date, (day) => ({ ...day, urges: day.urges.filter((u) => u.id !== id) })),
    [updateDay]
  );

  const skipPrompt = useCallback(() => {
    setJournal((prev) => ({ ...prev, promptSkips: prev.promptSkips + 1 }));
  }, []);

  /**
   * Adding is validated against the list as it stands, so the refusal can say
   * which rule was hit. It reads the ref rather than closing over the list,
   * which keeps the callback stable across every keystroke elsewhere.
   */
  const addHabit = useCallback((name: string): string | null => {
    const result = addToList(latest.current.habits, name);
    if (!result.ok) return result.reason;
    setJournal((prev) => ({ ...prev, habits: result.habits }));
    return null;
  }, []);

  // Only the list changes: a day that already ticked this habit keeps it, and
  // goes on showing it.
  const removeHabit = useCallback((habit: string) => {
    setJournal((prev) => ({ ...prev, habits: removeFromList(prev.habits, habit) }));
  }, []);

  const addTask = useCallback((text: string): string | null => {
    const result = addToTasks(latest.current.tasks, text);
    if (!result.ok) return result.reason;
    setJournal((prev) => ({ ...prev, tasks: result.tasks }));
    return null;
  }, []);

  const toggleTask = useCallback((id: string) => {
    setJournal((prev) => ({ ...prev, tasks: toggleInTasks(prev.tasks, id) }));
  }, []);

  const editTask = useCallback((id: string, text: string) => {
    setJournal((prev) => ({ ...prev, tasks: editInTasks(prev.tasks, id, text) }));
  }, []);

  const removeTask = useCallback((id: string) => {
    setJournal((prev) => ({ ...prev, tasks: removeFromTasks(prev.tasks, id) }));
  }, []);

  const clearDone = useCallback(() => {
    setJournal((prev) => ({ ...prev, tasks: clearDoneTasks(prev.tasks) }));
  }, []);

  // Persisted by the same debounce as everything else; an import is just a
  // large edit.
  const replaceJournal = useCallback((next: Journal) => setJournal(next), []);

  return {
    days: journal.days,
    journal,
    today,
    todayDate,
    habits: journal.habits,
    tasks: journal.tasks,
    promptSkips: journal.promptSkips,
    patchDay,
    toggleHabit,
    adjustSleep,
    logUrge,
    updateUrge,
    deleteUrge,
    skipPrompt,
    addHabit,
    removeHabit,
    addTask,
    toggleTask,
    editTask,
    removeTask,
    clearDoneTasks: clearDone,
    replaceJournal,
  };
}
