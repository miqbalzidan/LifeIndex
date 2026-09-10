import { HABIT_MAX_COUNT, HABIT_MAX_LENGTH } from "./constants.ts";
import type { Day } from "../types.ts";

/**
 * The habit list is the user's, so this is where a typed-in name is made safe
 * to keep: trimmed, bounded, and unique without being fussy about case.
 */

/** Collapses inner whitespace and trims, so "  No   phone " is one habit. */
export function cleanHabitName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, HABIT_MAX_LENGTH);
}

const sameHabit = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type AddHabitResult = { ok: true; habits: string[] } | { ok: false; reason: string };

export function addHabit(habits: string[], raw: string): AddHabitResult {
  const name = cleanHabitName(raw);
  if (!name) return { ok: false, reason: "Give the habit a name." };
  if (habits.some((h) => sameHabit(h, name))) return { ok: false, reason: "That one is already here." };
  if (habits.length >= HABIT_MAX_COUNT) {
    return { ok: false, reason: `That's as many as fit — ${HABIT_MAX_COUNT} is the most.` };
  }
  return { ok: true, habits: [...habits, name] };
}

export function removeHabit(habits: string[], name: string): string[] {
  return habits.filter((h) => !sameHabit(h, name));
}

/** Drops blanks, over-long names and duplicates from a list off disk or a file. */
export function cleanHabitList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const name = cleanHabitName(value);
    if (!name || out.some((h) => sameHabit(h, name))) continue;
    out.push(name);
    if (out.length === HABIT_MAX_COUNT) break;
  }
  return out;
}

/**
 * What to show against one day: the current list, plus anything that day
 * recorded which has since been removed.
 *
 * Dropping a habit from the list is a decision about what to track from now on,
 * not permission to quietly rewrite what a past day says happened.
 */
export function habitsForDay(habits: string[], day: Day): string[] {
  const extra = day.habits.filter((h) => !habits.some((known) => sameHabit(known, h)));
  return [...habits, ...extra];
}

/** Merges two lists without losing either side's — for an imported file. */
export function mergeHabitLists(mine: string[], theirs: string[]): string[] {
  const merged = [...mine];
  for (const name of theirs) {
    if (!merged.some((h) => sameHabit(h, name)) && merged.length < HABIT_MAX_COUNT) {
      merged.push(name);
    }
  }
  return merged;
}
