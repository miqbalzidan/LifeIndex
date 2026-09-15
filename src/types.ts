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

/**
 * Something you mean to do once, that stays until it is done.
 *
 * Distinct from a habit: a habit is ticked again every night and starts each
 * day blank; a task is ticked once and stays ticked.
 */
export interface Task {
  id: string;
  text: string;
  done: boolean;
  /** Local calendar date it was added, `YYYY-MM-DD`. */
  added: string;
  /** Local calendar date it was finished, or `null` while it is open. */
  doneOn: string | null;
}

export type Tab = "today" | "plan" | "archive" | "insights";

export interface Journal {
  /** Sparse: only days the user has actually touched. Keyed by `Day.date`. */
  days: Record<string, Day>;
  /** The habits on offer, in the order they are shown. The user's to edit. */
  habits: string[];
  /** The standing list of one-off things to do. Not per-day; it carries over. */
  tasks: Task[];
  /** How many times the prompt has been skipped, ever. */
  promptSkips: number;
}
