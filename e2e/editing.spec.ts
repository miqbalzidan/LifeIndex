import { expect, test, type Page } from "@playwright/test";
import { entry, seed } from "./support.ts";

const reader = (page: Page) => page.getByRole("dialog", { name: "Entry" });
const sheet = (page: Page) => page.getByRole("dialog", { name: /Log an urge|Edit urge/ });

async function logUrge(page: Page, outcome: "Rode it out" | "Gave in", note: string) {
  await page.getByRole("button", { name: "Log urge" }).click();
  await page.getByRole("button", { name: "bored", exact: true }).click();
  await page.getByLabel("What was going on?").fill(note);
  await page.getByRole("button", { name: outcome, exact: true }).click();
}

test.describe("changing an urge already logged", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await logUrge(page, "Rode it out", "first thoughts");
  });

  test("opens the urge as it was logged, at the minute it was logged", async ({ page }) => {
    const loggedAt = await page.locator(".timeline-time").textContent();

    await page.locator(".timeline-item").click();
    await expect(page.locator(".sheet-title")).toHaveText("Edit urge");
    await expect(page.locator(".sheet-time")).toHaveText(loggedAt!);
    await expect(page.getByLabel("What was going on?")).toHaveValue("first thoughts");
    await expect(page.getByRole("button", { name: "bored", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("saves a correction, including the other outcome, and keeps its place", async ({ page }) => {
    await page.locator(".timeline-item").click();
    await page.getByLabel("What was going on?").fill("what actually happened");
    await page.getByLabel("What you did instead").fill("went to bed");
    await page.getByRole("button", { name: "stressed", exact: true }).click();
    await page.getByRole("radio", { name: "Intensity 5 of 5" }).click();
    await page.getByRole("button", { name: "Gave in", exact: true }).click();

    const item = page.locator(".timeline-item");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("stressed");
    await expect(item).toContainText("5/5");
    await expect(item).toContainText("what actually happened went to bed Gave in.");

    await page.reload();
    await expect(page.locator(".timeline-item")).toContainText("Gave in.");
  });

  test("closing without saving leaves the urge alone", async ({ page }) => {
    await page.locator(".timeline-item").click();
    await page.getByLabel("What was going on?").fill("a change I do not want");
    await page.getByRole("button", { name: "Close without saving" }).click();

    await expect(page.locator(".timeline-item")).toContainText("first thoughts Rode it out.");
  });

  test("asks before deleting, and keeps the urge if told to", async ({ page }) => {
    await page.locator(".timeline-item").click();
    await page.getByRole("button", { name: "Delete this urge" }).click();

    await expect(page.locator(".sheet-confirm")).toContainText("Delete this urge?");
    await page.getByRole("button", { name: "Keep", exact: true }).click();
    await expect(page.locator(".sheet-confirm")).toHaveCount(0);

    await page.getByRole("button", { name: "Close without saving" }).click();
    await expect(page.locator(".timeline-item")).toHaveCount(1);
  });

  test("deletes the urge when confirmed", async ({ page }) => {
    await page.locator(".timeline-item").click();
    await page.getByRole("button", { name: "Delete this urge" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator(".timeline-item")).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".timeline-item")).toHaveCount(0);
  });

  test("deleting the only thing on a day takes the day out of the archive", async ({ page }) => {
    await page.getByRole("tab", { name: "Archive" }).click();
    await expect(page.locator("button.entry")).toHaveCount(1);

    await page.getByRole("tab", { name: "Today" }).click();
    await page.locator(".timeline-item").click();
    await page.getByRole("button", { name: "Delete this urge" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await page.getByRole("tab", { name: "Archive" }).click();
    await expect(page.locator("button.entry")).toHaveCount(0);
  });

  test("only one of several urges is changed", async ({ page }) => {
    await logUrge(page, "Gave in", "second thoughts");
    await expect(page.locator(".timeline-item")).toHaveCount(2);

    await page.locator(".timeline-item").first().click();
    await page.getByLabel("What was going on?").fill("corrected");
    await page.getByRole("button", { name: "Rode it out", exact: true }).click();

    await expect(page.locator(".timeline-item").first()).toContainText("corrected");
    await expect(page.locator(".timeline-item").last()).toContainText("second thoughts");
  });
});

test.describe("a past day is the day itself, not a printout of it", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      "2026-03-20": entry("2026-03-20", {
        text: "A typo I want to fix.",
        mood: 2,
        urges: [
          { id: "a", t: 1345, level: 4, trigger: "tired", note: "late", alt: "", outcome: "gave" },
        ],
      }),
    });
    await page.getByRole("tab", { name: "Archive" }).click();
    await page.locator("button.entry").click();
  });

  test("the writing can be corrected, and the archive follows", async ({ page }) => {
    await reader(page).locator("textarea.editor").fill("A typo I have now fixed.");
    await page.getByRole("button", { name: "← Archive" }).click();

    await expect(page.locator("button.entry")).toContainText("A typo I have now fixed.");
    await page.reload();
    await page.getByRole("tab", { name: "Archive" }).click();
    await expect(page.locator("button.entry")).toContainText("A typo I have now fixed.");
  });

  test("the measures for that day can be set", async ({ page }) => {
    await reader(page).getByRole("radio", { name: "Mood 5 of 5" }).click();
    await reader(page).getByRole("button", { name: "Half an hour more sleep" }).click();
    await expect(reader(page).locator(".stepper-value")).toContainText("7 h");
    await reader(page).getByRole("button", { name: "Read", exact: true }).click();

    await page.reload();
    await page.getByRole("tab", { name: "Archive" }).click();
    await page.locator("button.entry").click();
    await expect(reader(page).getByRole("radio", { name: "Mood 5 of 5" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await expect(reader(page).locator(".stepper-value")).toContainText("7 h");
    await expect(reader(page).getByRole("button", { name: "Read", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("an urge on that day can be corrected without leaving the entry", async ({ page }) => {
    await reader(page).locator(".timeline-item").click();
    await expect(page.locator(".sheet-title")).toHaveText("Edit urge");
    await expect(page.locator(".sheet-time")).toHaveText("10:25pm");

    await page.getByLabel("What was going on?").fill("corrected months later");
    await page.getByRole("button", { name: "Rode it out", exact: true }).click();

    // The entry is still open behind it.
    await expect(reader(page)).toBeVisible();
    await expect(reader(page).locator(".timeline-item")).toContainText(
      "corrected months later Rode it out."
    );
  });

  test("escape closes the sheet on top and leaves the entry open behind it", async ({ page }) => {
    await reader(page).locator(".timeline-item").click();
    await expect(sheet(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(reader(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(reader(page)).toHaveCount(0);
  });

  test("an urge deleted from a past day stays deleted", async ({ page }) => {
    await reader(page).locator(".timeline-item").click();
    await page.getByRole("button", { name: "Delete this urge" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(reader(page).locator(".timeline-item")).toHaveCount(0);
    await page.reload();
    await page.getByRole("tab", { name: "Archive" }).click();
    await page.locator("button.entry").click();
    await expect(reader(page).locator(".timeline-item")).toHaveCount(0);
  });
});
