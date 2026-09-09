import { toIso } from "../src/lib/date.ts";
import type { Day, Urge } from "../src/types.ts";

let counter = 0;

export function urge(over: Partial<Urge> = {}): Urge {
  counter += 1;
  return {
    id: `urge-${counter}`,
    t: 22 * 60,
    level: 3,
    trigger: "bored",
    note: "",
    alt: "",
    outcome: "rode",
    ...over,
  };
}

export function day(date: string, over: Partial<Omit<Day, "date">> = {}): Day {
  return { date, text: "", mood: null, energy: null, sleep: 7, habits: [], urges: [], ...over };
}

/** A journal keyed by date, the shape the insight functions read. */
export function journalOf(...days: Day[]): Record<string, Day> {
  return Object.fromEntries(days.map((d) => [d.date, d]));
}

/** The ISO date `back` days before `now` — for placing a day inside a window. */
export function daysBefore(back: number, now: Date): string {
  return toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back));
}
