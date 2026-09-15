import { beforeEach, describe, expect, it } from "vitest";
import { installStorage, type FakeStorage } from "../../test/localStorage.ts";
import { day, urge } from "../../test/factory.ts";
import { DEFAULT_HABITS, DEFAULT_SLEEP, SLEEP_MAX, SLEEP_MIN } from "./constants.ts";
import { blankDay, dayHasContent, emptyJournal, loadJournal, saveJournal } from "./storage.ts";

const KEY = "nightly.journal.v1";

let storage: FakeStorage;
beforeEach(() => {
  storage = installStorage();
});

/** Puts `value` in storage as the raw stored string. */
const store = (value: unknown) => storage.setItem(KEY, JSON.stringify(value));

/** Reads one day back out of a stored journal. */
const loadDay = (date: string) => loadJournal().days[date];

describe("loadJournal", () => {
  it("returns an empty journal on a fresh install", () => {
    expect(loadJournal()).toEqual(emptyJournal());
  });

  it("survives storage that refuses to be read at all", () => {
    storage.failOnRead = true;
    expect(() => loadJournal()).not.toThrow();
    expect(loadJournal()).toEqual(emptyJournal());
  });

  it("survives a value that is not JSON", () => {
    storage.setItem(KEY, "{not json");
    expect(loadJournal()).toEqual(emptyJournal());
  });

  it.each([42, null, "a string", [1, 2, 3]])("survives a stored %o", (value) => {
    store(value);
    expect(loadJournal().days).toEqual({});
  });

  it("round-trips a journal it wrote itself", () => {
    const journal = {
      days: { "2026-09-09": day("2026-09-09", { text: "hello", mood: 4, urges: [urge()] }) },
      habits: ["Walk", "Stretch"],
      tasks: [
        { id: "t1", text: "Move the charger", done: false, added: "2026-09-01", doneOn: null },
      ],
      promptSkips: 3,
    };
    saveJournal(journal);
    expect(loadJournal()).toEqual(journal);
  });

  it("drops one corrupt day rather than the whole archive", () => {
    store({
      days: {
        "2026-09-08": { ...day("2026-09-08", { text: "kept" }) },
        "2026-09-09": "not a day at all",
        "not-a-date": { ...day("x", { text: "bad key" }) },
        "2026-9-9": { ...day("x", { text: "unpadded key" }) },
        "2026-09-10": { ...day("2026-09-10", { text: "also kept" }) },
      },
      promptSkips: 0,
    });
    expect(Object.keys(loadJournal().days)).toEqual(["2026-09-08", "2026-09-10"]);
  });
});

describe("field validation", () => {
  it.each([0, 6, 2.5, "3", null, undefined])("rejects %o as a rating", (mood) => {
    store({ days: { "2026-09-09": { ...day("2026-09-09"), mood, energy: mood } } });
    expect(loadDay("2026-09-09")).toMatchObject({ mood: null, energy: null });
  });

  it("keeps a rating of 1 through 5", () => {
    for (const mood of [1, 2, 3, 4, 5]) {
      store({ days: { "2026-09-09": { ...day("2026-09-09"), mood } } });
      expect(loadDay("2026-09-09")?.mood).toBe(mood);
    }
  });

  it.each(["seven", null, undefined, NaN, Infinity])("reads %o as no sleep recorded", (sleep) => {
    store({ days: { "2026-09-09": { ...day("2026-09-09"), sleep } } });
    expect(loadDay("2026-09-09")?.sleep).toBeNull();
  });

  it("keeps a recorded night, including a night of none at all", () => {
    for (const sleep of [0, 6.5, DEFAULT_SLEEP, SLEEP_MAX]) {
      store({ days: { "2026-09-09": { ...day("2026-09-09"), sleep } } });
      expect(loadDay("2026-09-09")?.sleep).toBe(sleep);
    }
  });

  it("clamps sleep to a plausible night", () => {
    store({ days: { "2026-09-09": { ...day("2026-09-09"), sleep: 99 } } });
    expect(loadDay("2026-09-09")?.sleep).toBe(SLEEP_MAX);
    store({ days: { "2026-09-09": { ...day("2026-09-09"), sleep: -5 } } });
    expect(loadDay("2026-09-09")?.sleep).toBe(SLEEP_MIN);
  });

  it("keeps only the habits that are strings", () => {
    store({ days: { "2026-09-09": { ...day("2026-09-09"), habits: ["Walk", 3, null, "Read"] } } });
    expect(loadDay("2026-09-09")?.habits).toEqual(["Walk", "Read"]);
    store({ days: { "2026-09-09": { ...day("2026-09-09"), habits: "Walk" } } });
    expect(loadDay("2026-09-09")?.habits).toEqual([]);
  });

  it("keeps the text as written, and replaces a non-string with nothing", () => {
    store({ days: { "2026-09-09": { ...day("2026-09-09"), text: { oops: true } } } });
    expect(loadDay("2026-09-09")?.text).toBe("");
  });
});

describe("urge validation", () => {
  const withUrges = (urges: unknown) => {
    store({ days: { "2026-09-09": { ...day("2026-09-09"), urges } } });
    return loadDay("2026-09-09")?.urges ?? [];
  };

  it("drops an urge with no usable time", () => {
    expect(withUrges([{ ...urge(), t: "late" }, { ...urge(), t: NaN }, null, "x"])).toEqual([]);
  });

  it("clamps and rounds the time into the day", () => {
    expect(withUrges([{ ...urge(), t: 5000 }])[0]?.t).toBe(1439);
    expect(withUrges([{ ...urge(), t: -10 }])[0]?.t).toBe(0);
    expect(withUrges([{ ...urge(), t: 61.6 }])[0]?.t).toBe(62);
  });

  it("sorts the timeline by time of night", () => {
    const times = withUrges([
      { ...urge(), t: 1400 },
      { ...urge(), t: 60 },
      { ...urge(), t: 700 },
    ]).map((u) => u.t);
    expect(times).toEqual([60, 700, 1400]);
  });

  it("gives an urge an id when the stored one has none", () => {
    const [first, second] = withUrges([
      { ...urge(), id: undefined, t: 100 },
      { ...urge(), id: undefined, t: 200 },
    ]);
    expect(first?.id).toBeTruthy();
    expect(second?.id).toBeTruthy();
    expect(first?.id).not.toBe(second?.id);
  });

  it("falls back to the middle of the scale and a generic trigger", () => {
    const [u] = withUrges([{ t: 100, level: 9, trigger: "" }]);
    expect(u).toMatchObject({ level: 3, trigger: "other" });
  });

  it("only reads an outcome as 'gave' when it says so exactly", () => {
    expect(withUrges([{ t: 1, outcome: "gave" }])[0]?.outcome).toBe("gave");
    for (const outcome of ["rode", "GAVE", "gave in", true, null, undefined]) {
      expect(withUrges([{ t: 1, outcome }])[0]?.outcome).toBe("rode");
    }
  });
});

describe("the habit list", () => {
  it("starts a new journal with the defaults", () => {
    expect(loadJournal().habits).toEqual(DEFAULT_HABITS);
    expect(emptyJournal().habits).toEqual(DEFAULT_HABITS);
  });

  it("gives the defaults to a journal written before habits were editable", () => {
    store({ days: {}, promptSkips: 0 });
    expect(loadJournal().habits).toEqual(DEFAULT_HABITS);
  });

  it("keeps an empty list, because removing them all is a choice", () => {
    store({ days: {}, habits: [], promptSkips: 0 });
    expect(loadJournal().habits).toEqual([]);
  });

  it("drops what it cannot use and keeps the order of the rest", () => {
    store({ days: {}, habits: ["Walk", 3, "", "   ", "walk", null, "Read"], promptSkips: 0 });
    expect(loadJournal().habits).toEqual(["Walk", "Read"]);
  });

  it("falls back to the defaults when the list is not a list", () => {
    store({ days: {}, habits: "Walk", promptSkips: 0 });
    expect(loadJournal().habits).toEqual(DEFAULT_HABITS);
  });
});

describe("the standing task list", () => {
  it("starts empty, unlike habits, which ship with defaults", () => {
    expect(loadJournal().tasks).toEqual([]);
    expect(emptyJournal().tasks).toEqual([]);
  });

  it("is empty for a journal written before the list existed", () => {
    store({ days: {}, habits: [], promptSkips: 0 });
    expect(loadJournal().tasks).toEqual([]);
  });

  it("drops entries with no usable text and keeps the rest in order", () => {
    store({
      days: {},
      tasks: [
        { id: "a", text: "First", done: false, added: "2026-09-01", doneOn: null },
        { id: "b", text: "   ", done: false, added: "2026-09-01", doneOn: null },
        "not a task",
        { id: "c", text: "Second", done: true, added: "2026-09-02", doneOn: "2026-09-03" },
      ],
      promptSkips: 0,
    });
    expect(loadJournal().tasks.map((t) => t.text)).toEqual(["First", "Second"]);
  });

  it("refuses a finish date on a task that is not finished", () => {
    store({
      days: {},
      tasks: [{ id: "a", text: "Open", done: false, added: "2026-09-01", doneOn: "2026-09-02" }],
      promptSkips: 0,
    });
    expect(loadJournal().tasks[0]?.doneOn).toBeNull();
  });
});

describe("promptSkips", () => {
  it.each([-1, "3", null, undefined])("reads %o as no skips", (promptSkips) => {
    store({ days: {}, promptSkips });
    expect(loadJournal().promptSkips).toBe(0);
  });

  it("floors a fractional count", () => {
    store({ days: {}, promptSkips: 3.7 });
    expect(loadJournal().promptSkips).toBe(3);
  });
});

describe("saveJournal", () => {
  it("does not throw when the quota is full", () => {
    storage.failOnWrite = true;
    expect(() => saveJournal(emptyJournal())).not.toThrow();
  });
});

describe("dayHasContent", () => {
  it("is false for a day that has only been opened", () => {
    expect(dayHasContent(blankDay("2026-09-09"))).toBe(false);
    expect(blankDay("2026-09-09").sleep).toBeNull();
  });

  it("is false for whitespace alone", () => {
    expect(dayHasContent(blankDay("2026-09-09"))).toBe(false);
    expect(dayHasContent({ ...blankDay("2026-09-09"), text: "   \n " })).toBe(false);
  });

  it.each([
    ["text", { text: "something" }],
    ["mood", { mood: 3 as const }],
    ["energy", { energy: 3 as const }],
    ["habits", { habits: ["Walk"] }],
    ["urges", { urges: [urge()] }],
    ["a recorded night", { sleep: DEFAULT_SLEEP }],
    ["a recorded night of none", { sleep: 0 }],
  ])("is true once there is %s", (_name, patch) => {
    expect(dayHasContent({ ...blankDay("2026-09-09"), ...patch })).toBe(true);
  });
});
