import { describe, expect, it } from "vitest";
import { day, urge } from "../../test/factory.ts";
import { emptyJournal } from "./storage.ts";
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  buildExport,
  exportFilename,
  readImport,
  serialiseExport,
} from "./transfer.ts";
import type { Journal } from "../types.ts";

const journalOf = (...days: ReturnType<typeof day>[]): Journal => ({
  days: Object.fromEntries(days.map((d) => [d.date, d])),
  habits: ["Walk", "Read"],
  tasks: [],
  promptSkips: 0,
});

const sample = journalOf(
  day("2026-09-08", { text: "a night in september", mood: 4, sleep: 6.5 }),
  day("2026-09-09", { text: "the next one", urges: [urge({ outcome: "gave" })] })
);

describe("buildExport", () => {
  it("tags the file so it can be recognised later", () => {
    const file = buildExport(sample, new Date(2026, 8, 9, 22, 0));
    expect(file.format).toBe(EXPORT_FORMAT);
    expect(file.version).toBe(EXPORT_VERSION);
    expect(file.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.keys(file.days)).toEqual(["2026-09-08", "2026-09-09"]);
  });
});

describe("serialiseExport", () => {
  it("writes indented JSON that ends in a newline", () => {
    const text = serialiseExport(sample);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "format"');
    expect(JSON.parse(text).days["2026-09-08"].text).toBe("a night in september");
  });
});

describe("exportFilename", () => {
  it("is named for the local day it was taken", () => {
    expect(exportFilename(new Date(2026, 8, 9, 23, 30))).toBe("nightly-2026-09-09.json");
  });
});

describe("readImport", () => {
  const file = (value: unknown) => JSON.stringify(value);

  it("round-trips an export back into an empty journal", () => {
    const result = readImport(serialiseExport(sample), emptyJournal());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.journal.days).toEqual(sample.days);
    expect(result.added).toBe(2);
    expect(result.replaced).toBe(0);
  });

  it.each([
    ["not JSON at all", "{ this is not json"],
    ["an array", file([1, 2, 3])],
    ["a number", file(42)],
    ["a file from something else", file({ format: "other.app", days: {} })],
    ["an object that is not a journal", file({ hello: "world" })],
  ])("refuses %s", (_name, text) => {
    const result = readImport(text, emptyJournal());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBeTruthy();
  });

  it("refuses a file from a newer version rather than half-reading it", () => {
    const result = readImport(
      file({ format: EXPORT_FORMAT, version: EXPORT_VERSION + 1, days: sample.days }),
      emptyJournal()
    );
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("newer version") });
  });

  it("accepts a copy taken straight out of localStorage, with no format tag", () => {
    const result = readImport(file({ days: sample.days, promptSkips: 2 }), emptyJournal());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.journal.days)).toHaveLength(2);
  });

  it("says so when there is nothing in the file to import", () => {
    const result = readImport(file(buildExport(emptyJournal())), emptyJournal());
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("nothing in that file") });
  });

  it("accepts a file that holds only a standing list, with no days at all", () => {
    // What a second device exports before anything has been written on it.
    const planOnly: Journal = {
      days: {},
      habits: [],
      tasks: [{ id: "t1", text: "Move the charger", done: false, added: "2026-09-01", doneOn: null }],
      promptSkips: 0,
    };
    const result = readImport(serialiseExport(planOnly), emptyJournal());
    expect(result).toMatchObject({ ok: true, added: 0, replaced: 0, tasksAdded: 1 });
  });

  it("drops a malformed day rather than the whole file", () => {
    const result = readImport(
      file({ format: EXPORT_FORMAT, version: 1, days: { ...sample.days, "not-a-date": {} } }),
      emptyJournal()
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.journal.days)).toEqual(["2026-09-08", "2026-09-09"]);
  });

  describe("merging into a journal that already has days", () => {
    const local = journalOf(
      day("2026-09-09", { text: "what this device has for the 9th" }),
      day("2026-09-20", { text: "a day the file does not have" })
    );

    it("counts what it would add and what it would replace", () => {
      const result = readImport(serialiseExport(sample), local);
      expect(result).toMatchObject({ ok: true, added: 1, replaced: 1 });
    });

    it("keeps a day this device has and the file does not", () => {
      const result = readImport(serialiseExport(sample), local);
      if (!result.ok) throw new Error("expected the import to be readable");
      expect(result.journal.days["2026-09-20"]?.text).toBe("a day the file does not have");
    });

    it("lets the file win where both hold the same date", () => {
      const result = readImport(serialiseExport(sample), local);
      if (!result.ok) throw new Error("expected the import to be readable");
      expect(result.journal.days["2026-09-09"]?.text).toBe("the next one");
    });

    it("does not touch the journal it was given", () => {
      readImport(serialiseExport(sample), local);
      expect(local.days["2026-09-09"]?.text).toBe("what this device has for the 9th");
      expect(Object.keys(local.days)).toHaveLength(2);
    });

    it("carries the habit list so a second device gets the same habits", () => {
      const file = serialiseExport(journalOf(day("2026-09-08", { text: "x" })));
      expect(JSON.parse(file).habits).toEqual(["Walk", "Read"]);
    });

    it("unions the habit lists rather than letting either device lose one", () => {
      const mine: Journal = { days: {}, habits: ["Walk", "Water"], tasks: [], promptSkips: 0 };
      const result = readImport(
        JSON.stringify({
          format: EXPORT_FORMAT,
          days: sample.days,
          habits: ["Read", "Walk", "Stretch"],
        }),
        mine
      );
      if (!result.ok) throw new Error("expected the import to be readable");
      expect(result.journal.habits).toEqual(["Walk", "Water", "Read", "Stretch"]);
    });

  it("keeps the higher prompt-skip count", () => {
      const result = readImport(file({ format: EXPORT_FORMAT, days: sample.days, promptSkips: 9 }), {
        ...local,
        promptSkips: 3,
      });
      if (!result.ok) throw new Error("expected the import to be readable");
      expect(result.journal.promptSkips).toBe(9);
    });
  });
});
