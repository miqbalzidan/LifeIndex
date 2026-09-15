import { describe, expect, it } from "vitest";
import { TASK_MAX_COUNT, TASK_MAX_LENGTH } from "./constants.ts";
import {
  addTask,
  cleanTaskList,
  cleanTaskText,
  clearDone,
  doneTasks,
  editTask,
  mergeTaskLists,
  openTasks,
  removeTask,
  toggleTask,
} from "./tasks.ts";
import type { Task } from "../types.ts";

const NOW = new Date(2026, 8, 15);

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  text: "Move the charger",
  done: false,
  added: "2026-09-01",
  doneOn: null,
  ...over,
});

describe("cleanTaskText", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanTaskText("  Book   a  check-up ")).toBe("Book a check-up");
  });

  it("bounds the length", () => {
    expect(cleanTaskText("x".repeat(500))).toHaveLength(TASK_MAX_LENGTH);
  });
});

describe("addTask", () => {
  it("appends, open, dated today", () => {
    const result = addTask([], "Move the charger", NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks[0]).toMatchObject({
      text: "Move the charger",
      done: false,
      added: "2026-09-15",
      doneOn: null,
    });
    expect(result.tasks[0]?.id).toBeTruthy();
  });

  it("gives each task its own id", () => {
    const first = addTask([], "One", NOW);
    if (!first.ok) throw new Error("expected ok");
    const second = addTask(first.tasks, "Two", NOW);
    if (!second.ok) throw new Error("expected ok");
    expect(second.tasks[0]?.id).not.toBe(second.tasks[1]?.id);
  });

  it("refuses an empty one, and says why", () => {
    expect(addTask([], "   ", NOW)).toEqual({ ok: false, reason: "Give the task some words." });
  });

  it("allows the same words twice, unlike a habit", () => {
    // Two errands can reasonably read the same and still be two errands.
    const first = addTask([], "Call the clinic", NOW);
    if (!first.ok) throw new Error("expected ok");
    expect(addTask(first.tasks, "Call the clinic", NOW).ok).toBe(true);
  });

  it("refuses past the cap", () => {
    const full = Array.from({ length: TASK_MAX_COUNT }, (_, i) => task({ id: `t${i}` }));
    expect(addTask(full, "One more", NOW)).toMatchObject({ ok: false });
  });

  it("does not modify the list it was given", () => {
    const tasks = [task()];
    addTask(tasks, "Another", NOW);
    expect(tasks).toHaveLength(1);
  });
});

describe("toggleTask", () => {
  it("ticks a task off and records the day", () => {
    const [ticked] = toggleTask([task()], "t1", NOW);
    expect(ticked).toMatchObject({ done: true, doneOn: "2026-09-15" });
  });

  it("un-ticks it and forgets the day, so nothing claims a finish that was undone", () => {
    const [back] = toggleTask([task({ done: true, doneOn: "2026-09-15" })], "t1", NOW);
    expect(back).toMatchObject({ done: false, doneOn: null });
  });

  it("leaves the other tasks alone", () => {
    const tasks = [task({ id: "a" }), task({ id: "b" })];
    expect(toggleTask(tasks, "a", NOW)[1]).toEqual(tasks[1]);
  });
});

describe("editTask", () => {
  it("rewrites the words and keeps everything else", () => {
    const [edited] = editTask([task({ done: true, doneOn: "2026-09-10" })], "t1", "  Call  Dr Smith ");
    expect(edited).toMatchObject({
      id: "t1",
      text: "Call Dr Smith",
      done: true,
      doneOn: "2026-09-10",
      added: "2026-09-01",
    });
  });

  it("refuses to blank a task out", () => {
    expect(editTask([task()], "t1", "   ")[0]?.text).toBe("Move the charger");
  });
});

describe("removeTask and clearDone", () => {
  it("removes one by id", () => {
    expect(removeTask([task({ id: "a" }), task({ id: "b" })], "a").map((t) => t.id)).toEqual(["b"]);
  });

  it("sweeps only the finished ones", () => {
    const tasks = [task({ id: "a" }), task({ id: "b", done: true, doneOn: "2026-09-10" })];
    expect(clearDone(tasks).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("openTasks and doneTasks", () => {
  const tasks = [
    task({ id: "a", text: "Still to do" }),
    task({ id: "b", text: "Done first", done: true, doneOn: "2026-09-01" }),
    task({ id: "c", text: "Done later", done: true, doneOn: "2026-09-12" }),
  ];

  it("keeps open tasks in the order they were added", () => {
    expect(openTasks(tasks).map((t) => t.text)).toEqual(["Still to do"]);
  });

  it("puts the most recently finished first", () => {
    expect(doneTasks(tasks).map((t) => t.text)).toEqual(["Done later", "Done first"]);
  });
});

describe("mergeTaskLists", () => {
  it("adds a task only the other device has", () => {
    const merged = mergeTaskLists([task({ id: "a" })], [task({ id: "b", text: "Theirs" })]);
    expect(merged.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("does not duplicate a task both devices have", () => {
    expect(mergeTaskLists([task({ id: "a" })], [task({ id: "a" })])).toHaveLength(1);
  });

  it("lets done win in both directions", () => {
    // Ticking something off on one device must not be undone by importing an
    // older copy from the other.
    const mineDone = mergeTaskLists(
      [task({ id: "a", done: true, doneOn: "2026-09-05" })],
      [task({ id: "a" })]
    );
    expect(mineDone[0]).toMatchObject({ done: true, doneOn: "2026-09-05" });

    const theirsDone = mergeTaskLists(
      [task({ id: "a" })],
      [task({ id: "a", done: true, doneOn: "2026-09-07" })]
    );
    expect(theirsDone[0]).toMatchObject({ done: true, doneOn: "2026-09-07" });
  });

  it("keeps this device's wording where both have the task", () => {
    const merged = mergeTaskLists([task({ id: "a", text: "Mine" })], [task({ id: "a", text: "Theirs" })]);
    expect(merged[0]?.text).toBe("Mine");
  });

  it("stops at the cap", () => {
    const mine = Array.from({ length: TASK_MAX_COUNT }, (_, i) => task({ id: `m${i}` }));
    expect(mergeTaskLists(mine, [task({ id: "theirs" })])).toHaveLength(TASK_MAX_COUNT);
  });
});

describe("cleanTaskList", () => {
  it("is empty for anything that is not a list", () => {
    expect(cleanTaskList("nope")).toEqual([]);
    expect(cleanTaskList(undefined)).toEqual([]);
  });

  it("gives a task an id when the stored one is missing or repeated", () => {
    const out = cleanTaskList([
      { text: "One", done: false },
      { id: "dup", text: "Two", done: false },
      { id: "dup", text: "Three", done: false },
    ]);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((t) => t.id)).size).toBe(3);
  });

  it("only reads done as true when it says so exactly", () => {
    for (const done of ["true", 1, null, undefined]) {
      expect(cleanTaskList([{ id: "a", text: "x", done }])[0]?.done).toBe(false);
    }
    expect(cleanTaskList([{ id: "a", text: "x", done: true }])[0]?.done).toBe(true);
  });

  it("rejects a malformed date", () => {
    const [out] = cleanTaskList([
      { id: "a", text: "x", done: true, added: "yesterday", doneOn: "15/09/2026" },
    ]);
    expect(out?.added).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out?.doneOn).toBeNull();
  });

  it("stops at the cap", () => {
    const many = Array.from({ length: TASK_MAX_COUNT + 10 }, (_, i) => ({
      id: `t${i}`,
      text: `Task ${i}`,
      done: false,
    }));
    expect(cleanTaskList(many)).toHaveLength(TASK_MAX_COUNT);
  });
});
