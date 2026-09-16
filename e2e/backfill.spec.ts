import { expect, test, type Page } from "@playwright/test";
import { seed } from "./support.ts";

const reader = (page: Page) => page.getByRole("dialog", { name: "Entry" });

/** The ISO date `back` days before today, from the browser's own clock. */
const daysAgo = (page: Page, back: number) =>
  page.evaluate((n) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }, back);

test.describe("an urge written up after the fact", () => {
  test("the time can be set when logging one today", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Log urge" }).click();

    await page.getByLabel("Time").fill("23:40");
    await page.getByRole("button", { name: "Rode it out", exact: true }).click();

    await expect(page.locator(".timeline-time")).toHaveText("11:40pm");
    await page.reload();
    await expect(page.locator(".timeline-time")).toHaveText("11:40pm");
  });

  test("the time of one already logged can be corrected", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Log urge" }).click();
    await page.getByRole("button", { name: "Gave in", exact: true }).click();

    await page.locator(".timeline-item").click();
    await page.getByLabel("Time").fill("02:05");
    await page.getByRole("button", { name: "Gave in", exact: true }).click();

    await expect(page.locator(".timeline-time")).toHaveText("2:05am");
  });

  test("a half-typed time does not snap the urge to midnight", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Log urge" }).click();
    await page.getByLabel("Time").fill("23:40");
    await page.getByLabel("Time").fill("");
    await page.getByRole("button", { name: "Rode it out", exact: true }).click();

    await expect(page.locator(".timeline-time")).toHaveText("11:40pm");
  });
});

test.describe("a day you never wrote on", () => {
  test("can be opened from the archive and written up", async ({ page }) => {
    await page.goto("/");
    const missed = await daysAgo(page, 4);

    await page.getByRole("tab", { name: "Archive" }).click();
    await expect(page.locator("button.entry")).toHaveCount(0);

    await page.getByLabel("Open another day").fill(missed);
    await expect(reader(page)).toBeVisible();

    await reader(page).locator("textarea.editor").fill("Writing this up four days late.");
    await page.getByRole("button", { name: "← Archive" }).click();

    await expect(page.locator("button.entry")).toContainText("Writing this up four days late.");
    await page.reload();
    await page.getByRole("tab", { name: "Archive" }).click();
    await expect(page.locator("button.entry")).toContainText("Writing this up four days late.");
  });

  test("opening one and writing nothing leaves no trace", async ({ page }) => {
    await page.goto("/");
    const missed = await daysAgo(page, 4);

    await page.getByRole("tab", { name: "Archive" }).click();
    await page.getByLabel("Open another day").fill(missed);
    await expect(reader(page)).toBeVisible();
    await page.getByRole("button", { name: "← Archive" }).click();

    await expect(page.locator("button.entry")).toHaveCount(0);
    // Often nothing is written at all, so the key can be absent entirely.
    const stored = await page.evaluate(() => localStorage.getItem("nightly.journal.v1"));
    expect(stored ?? "").not.toContain(missed);
  });

  test("cannot be in the future", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Archive" }).click();

    const today = await daysAgo(page, 0);
    await expect(page.getByLabel("Open another day")).toHaveAttribute("max", today);
  });
});

test.describe("an urge on a past day", () => {
  test("is logged against that day, not today, and opens on a plausible hour", async ({ page }) => {
    await page.goto("/");
    const missed = await daysAgo(page, 3);

    await page.getByRole("tab", { name: "Archive" }).click();
    await page.getByLabel("Open another day").fill(missed);

    await page.getByRole("button", { name: "Log an urge on this day" }).click();

    // The sheet says which day it is writing to, since it isn't this one.
    await expect(page.locator(".sheet-day")).toBeVisible();
    // And opens at a round evening hour rather than whatever the clock says
    // now, which would quietly file a night urge under the morning.
    await expect(page.getByLabel("Time")).toHaveValue("22:00");

    await page.getByLabel("Time").fill("23:15");
    await page.getByRole("button", { name: "bored", exact: true }).click();
    await page.getByRole("button", { name: "Gave in", exact: true }).click();

    // It lands on that day, and the reader stays open on it.
    await expect(reader(page)).toBeVisible();
    await expect(reader(page).locator(".timeline-time")).toHaveText("11:15pm");

    // Today is untouched.
    await page.getByRole("button", { name: "← Archive" }).click();
    await page.getByRole("tab", { name: "Today" }).click();
    await expect(page.locator(".timeline-item")).toHaveCount(0);
  });

  test("counts against the day it happened on, in the insights", async ({ page }) => {
    await seed(page, {});
    const missed = await daysAgo(page, 3);

    await page.getByRole("tab", { name: "Archive" }).click();
    await page.getByLabel("Open another day").fill(missed);
    await page.getByRole("button", { name: "Log an urge on this day" }).click();
    await page.getByRole("button", { name: "Gave in", exact: true }).click();
    await page.getByRole("button", { name: "← Archive" }).click();

    // The window now runs back to that day: four days, one of them given in to.
    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.locator(".headline-of")).toHaveText("/ 4");
    await expect(page.locator(".headline-value")).toHaveText("3");
  });
});

test("the sheet does not name a day when the day is today", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Log urge" }).click();
  await expect(page.locator(".sheet-day")).toHaveCount(0);
  await expect(page.getByLabel("Time")).toBeVisible();
});
