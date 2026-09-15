export const PROMPTS = [
  "What did today ask of you that you didn't expect?",
  "Where did your attention go when you weren't watching it?",
  "Name one thing you'd rather not write down.",
  "What felt easier today than it did last month?",
  "Who were you around, and how did it leave you?",
  "What were you avoiding at 9pm?",
  "Describe the last hour before you sat down here.",
] as const;

/** What a new journal starts with. The list is the user's to change from there. */
export const DEFAULT_HABITS = ["Walk", "Read", "No phone in bed", "Water"];

/** Long enough for "No phone in bed", short enough to stay a chip. */
export const HABIT_MAX_LENGTH = 32;
/** The row is meant to be glanceable; past a dozen it stops being a row. */
export const HABIT_MAX_COUNT = 12;

/** A task is a sentence, not a label, so it gets more room than a habit name. */
export const TASK_MAX_LENGTH = 140;
/** High enough never to be met in practice; there only so storage can't run away. */
export const TASK_MAX_COUNT = 200;

export const TRIGGERS = ["tired", "bored", "alone", "stressed", "scrolling", "other"] as const;

/** Default hours of sleep on a day that has not been filled in yet. */
export const DEFAULT_SLEEP = 7;
export const SLEEP_STEP = 0.5;
export const SLEEP_MIN = 0;
export const SLEEP_MAX = 14;

/**
 * The longest the headline window ever gets — never a streak, always a share.
 *
 * The window is shorter than this until the journal is that old: it starts at
 * the first day you recorded anything and grows to 30. A fresh install reads
 * 0 / 0 rather than a perfect 0 / 30 it has not earned or a perfect 30 / 30 it
 * has not lived.
 */
export const CLEAN_WINDOW_DAYS = 30;
/** Charts read over a longer window so they have enough nights to mean anything. */
export const CHART_WINDOW_DAYS = 90;
