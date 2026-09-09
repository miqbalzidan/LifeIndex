import { DEFAULT_SLEEP, SLEEP_MAX, SLEEP_MIN } from "./constants.ts";
import type { Day, Journal, Outcome, Rating, Urge } from "../types.ts";

/**
 * Everything lives in this one localStorage key, on this one device. There is
 * no account and no server — the journal never leaves the phone.
 */
const KEY = "nightly.journal.v1";

export const emptyJournal = (): Journal => ({ days: {}, promptSkips: 0 });

export function blankDay(date: string): Day {
  return { date, text: "", mood: null, energy: null, sleep: DEFAULT_SLEEP, habits: [], urges: [] };
}

const isRating = (v: unknown): v is Rating => v === 1 || v === 2 || v === 3 || v === 4 || v === 5;

const asRating = (v: unknown): Rating | null => (isRating(v) ? v : null);

const asString = (v: unknown): string => (typeof v === "string" ? v : "");

function asUrge(raw: unknown, index: number): Urge | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  if (typeof u["t"] !== "number" || !Number.isFinite(u["t"])) return null;
  const outcome: Outcome = u["outcome"] === "gave" ? "gave" : "rode";
  return {
    id: typeof u["id"] === "string" ? u["id"] : `u${index}-${u["t"]}`,
    t: Math.max(0, Math.min(1439, Math.round(u["t"]))),
    level: asRating(u["level"]) ?? 3,
    trigger: asString(u["trigger"]) || "other",
    note: asString(u["note"]),
    alt: asString(u["alt"]),
    outcome,
  };
}

function asDay(date: string, raw: unknown): Day | null {
  if (!raw || typeof raw !== "object") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = raw as Record<string, unknown>;
  const sleep = typeof d["sleep"] === "number" && Number.isFinite(d["sleep"]) ? d["sleep"] : DEFAULT_SLEEP;
  return {
    date,
    text: asString(d["text"]),
    mood: asRating(d["mood"]),
    energy: asRating(d["energy"]),
    sleep: Math.max(SLEEP_MIN, Math.min(SLEEP_MAX, sleep)),
    habits: Array.isArray(d["habits"]) ? d["habits"].filter((h): h is string => typeof h === "string") : [],
    urges: Array.isArray(d["urges"])
      ? d["urges"].map(asUrge).filter((u): u is Urge => u !== null).sort((a, b) => a.t - b.t)
      : [],
  };
}

/**
 * Reads the journal back, discarding anything malformed rather than throwing.
 * A corrupt field should cost you one value, not the whole archive.
 */
export function loadJournal(): Journal {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage can be unavailable outright (private mode, blocked site data).
    return emptyJournal();
  }
  if (!raw) return emptyJournal();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyJournal();
    const source = (parsed as Record<string, unknown>)["days"];
    const days: Record<string, Day> = {};
    if (source && typeof source === "object") {
      for (const [date, value] of Object.entries(source as Record<string, unknown>)) {
        const day = asDay(date, value);
        if (day) days[date] = day;
      }
    }
    const skips = (parsed as Record<string, unknown>)["promptSkips"];
    return { days, promptSkips: typeof skips === "number" && skips >= 0 ? Math.floor(skips) : 0 };
  } catch {
    return emptyJournal();
  }
}

export function saveJournal(journal: Journal): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(journal));
  } catch {
    // Out of quota, or storage blocked. The in-memory session keeps working;
    // there is nowhere useful to report this that wouldn't interrupt writing.
  }
}

/** A day is worth persisting once it holds anything the user actually put there. */
export function dayHasContent(day: Day): boolean {
  return (
    day.text.trim() !== "" ||
    day.mood !== null ||
    day.energy !== null ||
    day.habits.length > 0 ||
    day.urges.length > 0 ||
    day.sleep !== DEFAULT_SLEEP
  );
}
