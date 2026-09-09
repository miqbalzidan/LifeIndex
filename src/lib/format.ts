import type { Day, Urge } from "../types.ts";

export const plural = (n: number, one: string, many = one + "s"): string => (n === 1 ? one : many);

/** `7 h` / `7.5 h` — never `7.0 h`. */
export function sleepLabel(hours: number): string {
  return hours.toFixed(1).replace(/\.0$/, "") + " h";
}

/**
 * One flat sentence for an urge: what was going on, what you did instead, and
 * how it went. The outcome is stated plainly and identically in both
 * directions — no punctuation or wording that reads as a verdict.
 */
export function urgeLine(u: Urge): string {
  const parts: string[] = [];
  if (u.note) parts.push(u.note);
  if (u.alt) parts.push(u.alt);
  parts.push(u.outcome === "rode" ? "Rode it out." : "Gave in.");
  return parts.join(" ");
}

export function urgeDetail(u: Urge): string {
  return `${u.trigger} · ${u.level}/5 · ${urgeLine(u)}`;
}

export function entryMeta(day: Day): string {
  return [
    day.mood ? `mood ${day.mood}` : null,
    day.sleep ? `${day.sleep}h` : null,
    day.urges.length ? `${day.urges.length} ${plural(day.urges.length, "urge")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function readerMeta(day: Day): string {
  return [
    day.mood ? `mood ${day.mood}/5` : null,
    day.energy ? `energy ${day.energy}/5` : null,
    `${day.sleep}h sleep`,
  ]
    .filter(Boolean)
    .join("  ·  ");
}

export function snippet(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 2) + "…" : text;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
