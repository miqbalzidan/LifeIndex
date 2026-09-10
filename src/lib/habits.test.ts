import { describe, expect, it } from "vitest";
import { day } from "../../test/factory.ts";
import { HABIT_MAX_COUNT, HABIT_MAX_LENGTH } from "./constants.ts";
import {
  addHabit,
  cleanHabitList,
  cleanHabitName,
  habitsForDay,
  mergeHabitLists,
  removeHabit,
} from "./habits.ts";

describe("cleanHabitName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanHabitName("  No   phone  in bed ")).toBe("No phone in bed");
    expect(cleanHabitName("\n\tWalk\t")).toBe("Walk");
  });

  it("is empty for a name that is only whitespace", () => {
    expect(cleanHabitName("   ")).toBe("");
    expect(cleanHabitName("")).toBe("");
  });

  it("bounds the length so a habit stays a chip", () => {
    expect(cleanHabitName("x".repeat(200))).toHaveLength(HABIT_MAX_LENGTH);
  });
});

describe("addHabit", () => {
  it("appends to the end, so the order is the order they were added", () => {
    const result = addHabit(["Walk"], "Stretch");
    expect(result).toEqual({ ok: true, habits: ["Walk", "Stretch"] });
  });

  it("cleans the name on the way in", () => {
    const result = addHabit([], "  cold   shower ");
    expect(result.ok && result.habits).toEqual(["cold shower"]);
  });

  it("refuses a blank name, and says why", () => {
    expect(addHabit([], "   ")).toEqual({ ok: false, reason: "Give the habit a name." });
  });

  it("refuses one already there, whatever the case", () => {
    expect(addHabit(["Walk"], "walk")).toMatchObject({ ok: false });
    expect(addHabit(["Walk"], "WALK")).toMatchObject({ ok: false });
  });

  it("refuses past the cap", () => {
    const full = Array.from({ length: HABIT_MAX_COUNT }, (_, i) => `Habit ${i}`);
    expect(addHabit(full, "One more")).toMatchObject({ ok: false });
    expect(addHabit(full.slice(0, -1), "One more")).toMatchObject({ ok: true });
  });

  it("does not modify the list it was given", () => {
    const habits = ["Walk"];
    addHabit(habits, "Stretch");
    expect(habits).toEqual(["Walk"]);
  });
});

describe("removeHabit", () => {
  it("takes the habit out, matching case-insensitively", () => {
    expect(removeHabit(["Walk", "Read"], "walk")).toEqual(["Read"]);
  });

  it("leaves the list alone when the habit is not in it", () => {
    expect(removeHabit(["Walk"], "Swim")).toEqual(["Walk"]);
  });
});

describe("cleanHabitList", () => {
  it("keeps usable names in order and drops the rest", () => {
    expect(cleanHabitList(["Walk", 3, "", null, "  Read ", "walk", {}])).toEqual(["Walk", "Read"]);
  });

  it("is empty for anything that is not a list", () => {
    expect(cleanHabitList("Walk")).toEqual([]);
    expect(cleanHabitList(undefined)).toEqual([]);
  });

  it("stops at the cap", () => {
    const many = Array.from({ length: HABIT_MAX_COUNT + 5 }, (_, i) => `Habit ${i}`);
    expect(cleanHabitList(many)).toHaveLength(HABIT_MAX_COUNT);
  });
});

describe("habitsForDay", () => {
  it("shows the current list for a day that ticked from it", () => {
    const today = day("2026-09-09", { habits: ["Walk"] });
    expect(habitsForDay(["Walk", "Read"], today)).toEqual(["Walk", "Read"]);
  });

  it("still shows a habit that has since been removed from the list", () => {
    // Dropping a habit decides what to track from here. It is not permission to
    // rewrite what a past day says happened.
    const past = day("2026-03-20", { habits: ["Walk", "Gym"] });
    expect(habitsForDay(["Walk", "Read"], past)).toEqual(["Walk", "Read", "Gym"]);
  });

  it("does not show a removed habit twice when the case differs", () => {
    const past = day("2026-03-20", { habits: ["walk"] });
    expect(habitsForDay(["Walk"], past)).toEqual(["Walk"]);
  });
});

describe("mergeHabitLists", () => {
  it("keeps this device's order and appends what only the other had", () => {
    expect(mergeHabitLists(["Walk", "Water"], ["Read", "Walk", "Stretch"])).toEqual([
      "Walk",
      "Water",
      "Read",
      "Stretch",
    ]);
  });

  it("does not duplicate across a difference in case", () => {
    expect(mergeHabitLists(["Walk"], ["walk"])).toEqual(["Walk"]);
  });

  it("stops at the cap rather than growing without bound", () => {
    const mine = Array.from({ length: HABIT_MAX_COUNT }, (_, i) => `Mine ${i}`);
    expect(mergeHabitLists(mine, ["Theirs"])).toHaveLength(HABIT_MAX_COUNT);
  });
});
