export type Outcome = "rode" | "gave";

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Urge {
  /** Stable id, so a list of urges logged in the same minute stays keyable. */
  id: string;
  /** Minutes past local midnight. */
  t: number;
  level: Rating;
  trigger: string;
  note: string;
  alt: string;
  outcome: Outcome;
}

export interface Day {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  text: string;
  mood: Rating | null;
  energy: Rating | null;
  /** Hours, in half-hour steps, or `null` if it was never recorded. */
  sleep: number | null;
  /** Names of the habits ticked on this day. */
  habits: string[];
  urges: Urge[];
}

export type Tab = "today" | "archive" | "insights";

export interface Journal {
  /** Sparse: only days the user has actually touched. Keyed by `Day.date`. */
  days: Record<string, Day>;
  /** The habits on offer, in the order they are shown. The user's to edit. */
  habits: string[];
  /** How many times the prompt has been skipped, ever. */
  promptSkips: number;
}
