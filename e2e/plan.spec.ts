import { expect, test, type Page } from "@playwright/test";

const tasks = (page: Page) => page.locator(".tasks .task");
const openPlan = (page: Page) => page.getByRole("tab", { name: "Plan" }).click();

async function add(page: Page, text: string) {
  await page.getByLabel("Something to do once").fill(text);
  await page.getByRole("button", { name: "Add" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await openPlan(page);
});

test("says what the page is for and nothing about what is undone", async ({ page }) => {
  await expect(page.locator(".tasks-empty")).toContainText("Nothing here yet.");
  await expect(page.locator(".tasks-empty")).toContainText("mean to do once");
  await expect(tasks(page)).toHaveCount(0);
});

test("a task survives a reload, and is not a per-day thing", async ({ page }) => {
  await add(page, "Move the phone charger to the hallway");
  await expect(tasks(page)).toHaveText(["Move the phone charger to the hallway"]);

  await page.reload();
  await openPlan(page);
  await expect(tasks(page)).toHaveText(["Move the phone charger to the hallway"]);

  // Nothing about it belongs to today: the day it was added stays empty.
  await page.getByRole("tab", { name: "Archive" }).click();
  await expect(page.locator("button.entry")).toHaveCount(0);
});

test("ticking one off moves it to Done, and it stays ticked", async ({ page }) => {
  await add(page, "Buy a cheap alarm clock");
  await add(page, "Book a check-up");

  await page.locator(".task-check").first().click();

  const doneSection = page.locator(".tasks-done");
  await expect(doneSection).toContainText("Buy a cheap alarm clock");
  await expect(doneSection.locator(".task-when")).toBeVisible();
  await expect(page.locator(".tasks").first().locator(".task")).toHaveText(["Book a check-up"]);

  await page.reload();
  await openPlan(page);
  await expect(page.locator(".tasks-done")).toContainText("Buy a cheap alarm clock");
});

test("un-ticking brings it back and forgets the finish date", async ({ page }) => {
  await add(page, "Book a check-up");
  await page.locator(".task-check").click();
  await expect(page.locator(".tasks-done")).toBeVisible();

  await page.locator(".task-check").click();
  await expect(page.locator(".tasks-done")).toHaveCount(0);
  await expect(page.locator(".task-when")).toHaveCount(0);
});

test("refuses an empty task and says why", async ({ page }) => {
  await add(page, "   ");
  await expect(page.locator(".task-error")).toHaveText("Give the task some words.");
  await expect(tasks(page)).toHaveCount(0);
});

test("the same words twice are two tasks, unlike habits", async ({ page }) => {
  await add(page, "Call the clinic");
  await add(page, "Call the clinic");
  await expect(tasks(page)).toHaveCount(2);
});

test.describe("editing the list", () => {
  test.beforeEach(async ({ page }) => {
    await add(page, "Call the clinic");
    await add(page, "Move the charger");
    await page.getByRole("button", { name: /^edit/ }).click();
  });

  test("rewrites a task in place", async ({ page }) => {
    await page.getByLabel('Edit "Call the clinic"').fill("Call Dr Smith about sleep");
    await page.getByRole("button", { name: /^done/ }).click();

    await expect(tasks(page).first()).toContainText("Call Dr Smith about sleep");
    await page.reload();
    await openPlan(page);
    await expect(tasks(page).first()).toContainText("Call Dr Smith about sleep");
  });

  test("removes one", async ({ page }) => {
    await page.getByRole("button", { name: "remove Call the clinic" }).click();
    await page.getByRole("button", { name: /^done/ }).click();
    await expect(tasks(page)).toHaveText(["Move the charger"]);
  });

  test("sweeps the finished ones and leaves the rest", async ({ page }) => {
    await page.getByRole("button", { name: /^done the list/ }).click();
    await page.locator(".task-check").first().click();
    await page.getByRole("button", { name: /^edit/ }).click();

    await page.getByRole("button", { name: "Clear the done ones" }).click();
    await expect(page.locator(".tasks-done")).toHaveCount(0);

    await page.getByRole("button", { name: /^done the list/ }).click();
    await expect(tasks(page)).toHaveText(["Move the charger"]);
  });
});

test("the standing list travels in an export and merges back", async ({ page, browser }) => {
  await add(page, "Move the charger");
  await add(page, "Book a check-up");
  await page.locator(".task-check").first().click(); // tick the first one off here

  await page.getByRole("tab", { name: "Archive" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export a copy" }).click(),
  ]);
  const stream = await download.createReadStream();
  const backup = await new Promise<string>((resolve, reject) => {
    let out = "";
    stream.on("data", (c) => (out += c));
    stream.on("end", () => resolve(out));
    stream.on("error", reject);
  });

  const file = JSON.parse(backup);
  expect(file.tasks).toHaveLength(2);
  expect(file.tasks.filter((t: { done: boolean }) => t.done)).toHaveLength(1);

  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL! });
  const second = await other.newPage();
  await second.goto("/");
  await openPlan(second);
  await second.getByLabel("Something to do once").fill("Only on this device");
  await second.getByRole("button", { name: "Add" }).click();

  await second.getByRole("tab", { name: "Archive" }).click();
  await second.getByRole("button", { name: "Import a copy" }).click();
  await second.locator('input[type="file"]').setInputFiles({
    name: "nightly-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup, "utf8"),
  });
  await second.getByRole("button", { name: "Import", exact: true }).click();

  await openPlan(second);
  // Neither device loses a task, and the one ticked off elsewhere arrives ticked.
  await expect(second.locator(".tasks .task")).toHaveCount(3);
  await expect(second.locator(".tasks-done")).toContainText("Move the charger");
  await expect(second.locator(".tasks").first()).toContainText("Only on this device");

  await other.close();
});

test("the plan screen keeps to the app's rules", async ({ page }) => {
  await add(page, "Move the charger");
  await page.locator(".task-check").click();

  // No icons.
  await expect(page.locator(".screen svg, .screen img")).toHaveCount(0);

  // No count of what is outstanding, no progress, no praise for finishing one.
  const text = await page.locator(".screen").innerText();
  expect(text).not.toMatch(/\b\d+\s*(of|\/)\s*\d+\b|% done|progress|complete[d]?!|well done|nice work/i);
});
