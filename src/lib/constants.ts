export const PROMPTS = [
  "What did today ask of you that you didn't expect?",
  "Where did your attention go when you weren't watching it?",
  "Name one thing you'd rather not write down.",
  "What felt easier today than it did last month?",
  "Who were you around, and how did it leave you?",
  "What were you avoiding at 9pm?",
  "Describe the last hour before you sat down here.",
] as const;

export const HABITS = ["Walk", "Read", "No phone in bed", "Water"] as const;

export const TRIGGERS = ["tired", "bored", "alone", "stressed", "scrolling", "other"] as const;

/** Default hours of sleep on a day that has not been filled in yet. */
export const DEFAULT_SLEEP = 7;
export const SLEEP_STEP = 0.5;
export const SLEEP_MIN = 0;
export const SLEEP_MAX = 14;

/** The headline stat is always a share of this window — never a streak. */
export const CLEAN_WINDOW_DAYS = 30;
/** Charts read over a longer window so they have enough nights to mean anything. */
export const CHART_WINDOW_DAYS = 90;
