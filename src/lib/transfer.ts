import { normaliseJournal } from "./storage.ts";
import { mergeHabitLists } from "./habits.ts";
import { mergeTaskLists } from "./tasks.ts";
import { toIso } from "./date.ts";
import type { Journal } from "../types.ts";

/**
 * Getting the journal off the device, and back on.
 *
 * A journal that lives only in `localStorage` is one "clear site data" away
 * from being gone, and there is no server to have kept a copy. So the file this
 * produces is the only backup that exists, and it is written to be readable on
 * its own terms years from now: plain JSON, one object per day, no compression
 * and no ids that mean anything only to this app.
 */

export const EXPORT_FORMAT = "nightly.journal";

/**
 * Bumped only for a change an older build could not read correctly. A file
 * declaring a higher version is refused rather than half-understood.
 */
export const EXPORT_VERSION = 1;

export interface JournalExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  days: Journal["days"];
  /** Carried so a second device gets the same habits, not just the same days. */
  habits: string[];
  /** The standing list travels too — it is the least day-shaped thing here. */
  tasks: Journal["tasks"];
  promptSkips: number;
}

export function buildExport(journal: Journal, now: Date = new Date()): JournalExport {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    days: journal.days,
    habits: journal.habits,
    tasks: journal.tasks,
    promptSkips: journal.promptSkips,
  };
}

/** Indented, so the file is legible in any text editor without tooling. */
export function serialiseExport(journal: Journal, now: Date = new Date()): string {
  return JSON.stringify(buildExport(journal, now), null, 2) + "\n";
}

export function exportFilename(now: Date = new Date()): string {
  return `nightly-${toIso(now)}.json`;
}

export type ImportResult =
  | {
      ok: true;
      journal: Journal;
      /** Dates in the file that this device does not have. */
      added: number;
      /** Dates in the file that this device already has, which the file replaces. */
      replaced: number;
      /** Standing tasks in the file that this device does not have. */
      tasksAdded: number;
    }
  | { ok: false; reason: string };

/**
 * Reads an export back and works out what applying it would do, without
 * applying it. The counts are what the caller shows before asking.
 */
export function readImport(text: string, current: Journal): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That file isn't readable as JSON." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "That file isn't a Nightly export." };
  }

  const record = parsed as Record<string, unknown>;
  const format = record["format"];
  const days = record["days"];

  // A file with no format tag is accepted if it is shaped like a journal, so a
  // copy someone took straight out of localStorage still restores.
  const looksLikeAJournal = !!days && typeof days === "object" && !Array.isArray(days);
  if (format !== undefined && format !== EXPORT_FORMAT) {
    return { ok: false, reason: "That file isn't a Nightly export." };
  }
  if (format === undefined && !looksLikeAJournal) {
    return { ok: false, reason: "That file isn't a Nightly export." };
  }

  const version = record["version"];
  if (typeof version === "number" && version > EXPORT_VERSION) {
    return { ok: false, reason: "That file was written by a newer version of Nightly." };
  }

  const incoming = normaliseJournal(parsed);
  const dates = Object.keys(incoming.days);

  // A journal is more than its days now. A file holding only a standing list —
  // which is exactly what a second device has before anything is written on it
  // — is still worth importing.
  if (dates.length === 0 && incoming.tasks.length === 0) {
    return { ok: false, reason: "There is nothing in that file to bring over." };
  }

  let added = 0;
  let replaced = 0;
  for (const date of dates) {
    if (current.days[date]) replaced += 1;
    else added += 1;
  }
  const tasksAdded = incoming.tasks.filter((t) => !current.tasks.some((m) => m.id === t.id)).length;

  return {
    ok: true,
    // Merged, not swapped in: a day this device has and the file does not is
    // kept. The file wins only where both hold the same date.
    journal: {
      days: { ...current.days, ...incoming.days },
      // Unioned rather than replaced: moving a journal between a phone and a
      // desktop should not cost either device a habit the other had not heard
      // of yet.
      habits: mergeHabitLists(current.habits, incoming.habits),
      tasks: mergeTaskLists(current.tasks, incoming.tasks),
      promptSkips: Math.max(current.promptSkips, incoming.promptSkips),
    },
    added,
    replaced,
    tasksAdded,
  };
}
