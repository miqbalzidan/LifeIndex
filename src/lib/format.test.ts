import { describe, expect, it } from "vitest";
import { day, urge } from "../../test/factory.ts";
import { entryMeta, plural, readerMeta, sleepLabel, snippet, urgeDetail, urgeLine, wordCount } from "./format.ts";

describe("plural", () => {
  it("agrees with the count", () => {
    expect(plural(1, "urge")).toBe("urge");
    expect(plural(0, "urge")).toBe("urges");
    expect(plural(2, "urge")).toBe("urges");
    expect(plural(2, "entry", "entries")).toBe("entries");
  });
});

describe("sleepLabel", () => {
  it("keeps the half hour and drops a trailing zero", () => {
    expect(sleepLabel(7)).toBe("7 h");
    expect(sleepLabel(7.5)).toBe("7.5 h");
    expect(sleepLabel(0)).toBe("0 h");
    expect(sleepLabel(12)).toBe("12 h");
  });
});

/**
 * The brief asks for the two outcomes to carry the same weight. That is mostly
 * a styling question, but the wording is half of it: neither line may read as
 * praise or as a verdict.
 */
describe("urgeLine", () => {
  it("states either outcome as one plain sentence", () => {
    expect(urgeLine(urge({ outcome: "rode" }))).toBe("Rode it out.");
    expect(urgeLine(urge({ outcome: "gave" }))).toBe("Gave in.");
  });

  it("builds both outcomes out of the same parts, in the same order", () => {
    const context = { note: "scrolling in bed", alt: "made tea" };
    const rode = urgeLine(urge({ ...context, outcome: "rode" }));
    const gave = urgeLine(urge({ ...context, outcome: "gave" }));

    expect(rode).toBe("scrolling in bed made tea Rode it out.");
    expect(gave).toBe("scrolling in bed made tea Gave in.");
    // Identical up to the closing sentence — no added emphasis on either path.
    expect(rode.replace(/Rode it out\.$/, "")).toBe(gave.replace(/Gave in\.$/, ""));
  });

  it("adds no exclamation, ellipsis or shouting to either outcome", () => {
    for (const outcome of ["rode", "gave"] as const) {
      const line = urgeLine(urge({ note: "a note", alt: "an alternative", outcome }));
      expect(line).not.toMatch(/[!?…*]/);
      expect(line).not.toMatch(/\b[A-Z]{2,}\b/);
    }
  });

  it("leaves out the parts that were not filled in", () => {
    expect(urgeLine(urge({ note: "just context", alt: "" }))).toBe("just context Rode it out.");
    expect(urgeLine(urge({ note: "", alt: "went for a walk" }))).toBe("went for a walk Rode it out.");
  });
});

describe("urgeDetail", () => {
  it("leads with the trigger and intensity", () => {
    expect(urgeDetail(urge({ trigger: "tired", level: 4, note: "late" }))).toBe(
      "tired · 4/5 · late Rode it out."
    );
  });
});

describe("entryMeta", () => {
  it("names only what is there", () => {
    expect(entryMeta(day("2026-09-09", { mood: 4, sleep: 7 }))).toBe("mood 4 · 7h");
    expect(entryMeta(day("2026-09-09"))).toBe("");
    expect(entryMeta(day("2026-09-09", { mood: 2, sleep: 6.5, urges: [urge()] }))).toBe(
      "mood 2 · 6.5h · 1 urge"
    );
    expect(entryMeta(day("2026-09-09", { sleep: 8, urges: [urge(), urge()] }))).toBe(
      "8h · 2 urges"
    );
  });

  it("says nothing about sleep on a night that was never recorded", () => {
    expect(entryMeta(day("2026-09-09", { mood: 3 }))).toBe("mood 3");
  });

  it("reports a recorded night of no sleep at all", () => {
    expect(entryMeta(day("2026-09-09", { sleep: 0 }))).toBe("0h");
  });
});

describe("readerMeta", () => {
  it("omits a mood or energy that was never set", () => {
    expect(readerMeta(day("2026-09-09", { mood: 3, energy: 5, sleep: 7 }))).toBe(
      "mood 3/5  ·  energy 5/5  ·  7h sleep"
    );
    expect(readerMeta(day("2026-09-09", { sleep: 6 }))).toBe("6h sleep");
  });

  it("does not claim a night of sleep that was never recorded", () => {
    expect(readerMeta(day("2026-09-09", { mood: 3 }))).toBe("mood 3/5");
    expect(readerMeta(day("2026-09-09"))).toBe("");
  });
});

describe("snippet", () => {
  it("leaves short text alone", () => {
    expect(snippet("short", 20)).toBe("short");
    expect(snippet("exactly ten", 11)).toBe("exactly ten");
  });

  it("trims longer text and marks the cut", () => {
    expect(snippet("abcdefghij", 5)).toBe("abc…");
    expect(snippet("abcdefghij", 5).length).toBeLessThan(5);
  });
});

describe("wordCount", () => {
  it("counts words, not characters or whitespace", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   \n\t ")).toBe(0);
    expect(wordCount("one")).toBe(1);
    expect(wordCount("  two   words  ")).toBe(2);
    expect(wordCount("a line\nand another line")).toBe(5);
  });
});
