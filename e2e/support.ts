import type { Page } from "@playwright/test";

const KEY = "nightly.journal.v1";

/**
 * One guard key per `seed` call. Each fixture applies once, on the navigation
 * that follows it, and never again on a reload — so a test can reload to check
 * that its own edit was saved, and can still re-seed a different fixture.
 */
let seedCount = 0;

export interface SeedDay {
  text?: string;
  mood?: number | null;
  energy?: number | null;
  sleep?: number | null;
  habits?: string[];
  urges?: {
    id: string;
    t: number;
    level: number;
    trigger: string;
    note: string;
    alt: string;
    outcome: "rode" | "gave";
  }[];
}

export function entry(date: string, over: SeedDay = {}) {
  return {
    date,
    text: "",
    mood: null,
    energy: null,
    sleep: null,
    habits: [],
    urges: [],
    ...over,
  };
}

/**
 * Puts a journal in storage before any app code runs, then loads onto it.
 *
 * Seeding after load and reloading does not work: the running app flushes its
 * own (empty) state on the way out and lands on top of the fixture.
 *
 * The init script runs on every navigation, so it is guarded to fire once.
 * Without that, a test that reloads to check something was saved would be
 * handed the original fixture back and never see its own edit.
 */
export async function seed(page: Page, days: Record<string, unknown>) {
  await page.addInitScript(
    ([key, value, guard]) => {
      if (sessionStorage.getItem(guard)) return;
      sessionStorage.setItem(guard, "1");
      localStorage.setItem(key, value);
    },
    [KEY, JSON.stringify({ days, promptSkips: 0 }), `nightly.e2e.seeded.${++seedCount}`] as const
  );
  await page.goto("/");
}

/** `count` consecutive days ending today, each holding a written entry. */
export async function seedRecentDays(page: Page, count: number, over: SeedDay = {}) {
  const days = await page.evaluate(
    ([n, template]) => {
      const out: Record<string, unknown> = {};
      const now = new Date();
      for (let i = 0; i < n; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
        out[date] = {
          date,
          text: `Entry from ${i} days ago.`,
          mood: null,
          energy: null,
          sleep: null,
          habits: [],
          urges: [],
          ...(template as object),
        };
      }
      return out;
    },
    [count, over] as const
  );
  await seed(page, days);
  return days;
}
