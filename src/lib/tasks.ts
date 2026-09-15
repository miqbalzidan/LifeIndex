import { TASK_MAX_COUNT, TASK_MAX_LENGTH } from "./constants.ts";
import { todayIso } from "./date.ts";
import type { Task } from "../types.ts";

/**
 * The standing list: things you mean to do once, which stay until you do them.
 *
 * Deliberately not a habit. A habit is ticked again every night and starts the
 * next day blank; a task is ticked once and stays ticked. "Move the charger out
 * of the bedroom" is a task. "No phone in bed" is a habit.
 *
 * Duplicate text is allowed, unlike habits — two errands can reasonably read the
 * same and still be two errands.
 */

export function cleanTaskText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, TASK_MAX_LENGTH);
}

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type AddTaskResult = { ok: true; tasks: Task[] } | { ok: false; reason: string };

export function addTask(tasks: Task[], raw: string, now: Date = new Date()): AddTaskResult {
  const text = cleanTaskText(raw);
  if (!text) return { ok: false, reason: "Give the task some words." };
  if (tasks.length >= TASK_MAX_COUNT) {
    return { ok: false, reason: `That's as many as the list holds — ${TASK_MAX_COUNT}.` };
  }
  const task: Task = { id: newId(), text, done: false, added: todayIso(now), doneOn: null };
  return { ok: true, tasks: [...tasks, task] };
}

/** Ticks or un-ticks one task, recording the day it was finished. */
export function toggleTask(tasks: Task[], id: string, now: Date = new Date()): Task[] {
  return tasks.map((task) =>
    task.id === id
      ? { ...task, done: !task.done, doneOn: task.done ? null : todayIso(now) }
      : task
  );
}

export function editTask(tasks: Task[], id: string, raw: string): Task[] {
  const text = cleanTaskText(raw);
  if (!text) return tasks;
  return tasks.map((task) => (task.id === id ? { ...task, text } : task));
}

export function removeTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id);
}

export function clearDone(tasks: Task[]): Task[] {
  return tasks.filter((task) => !task.done);
}

/** Still to do, in the order they were added. */
export const openTasks = (tasks: Task[]): Task[] => tasks.filter((t) => !t.done);

/** Finished, most recently finished first. */
export const doneTasks = (tasks: Task[]): Task[] =>
  tasks.filter((t) => t.done).sort((a, b) => (b.doneOn ?? "").localeCompare(a.doneOn ?? ""));

/** Reads a list off disk or out of a file, dropping what it cannot use. */
export function cleanTaskList(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  const out: Task[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const t = value as Record<string, unknown>;
    const text = typeof t["text"] === "string" ? cleanTaskText(t["text"]) : "";
    if (!text) continue;

    const id = typeof t["id"] === "string" && t["id"] && !seen.has(t["id"]) ? t["id"] : newId();
    seen.add(id);

    const isDate = (v: unknown): v is string =>
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const done = t["done"] === true;

    out.push({
      id,
      text,
      done,
      added: isDate(t["added"]) ? t["added"] : todayIso(),
      // A task that is not done has no finish date, whatever the file claimed.
      doneOn: done && isDate(t["doneOn"]) ? t["doneOn"] : null,
    });
    if (out.length === TASK_MAX_COUNT) break;
  }
  return out;
}

/**
 * Merges an imported list into this device's.
 *
 * Matched by id. Where both sides have a task, done wins: ticking something off
 * on your phone should not be undone by importing an older copy from the
 * desktop, and un-ticking is a thing you can always do here by hand.
 */
export function mergeTaskLists(mine: Task[], theirs: Task[]): Task[] {
  const merged = mine.map((task) => {
    const other = theirs.find((t) => t.id === task.id);
    if (!other) return task;
    if (task.done) return task;
    return other.done ? { ...task, done: true, doneOn: other.doneOn } : task;
  });

  for (const task of theirs) {
    if (!merged.some((t) => t.id === task.id) && merged.length < TASK_MAX_COUNT) {
      merged.push(task);
    }
  }
  return merged;
}
