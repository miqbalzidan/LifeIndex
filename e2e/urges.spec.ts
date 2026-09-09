import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

/** Fills in the sheet and closes it on `outcome`. */
async function logUrge(
  page: import("@playwright/test").Page,
  outcome: "Rode it out" | "Gave in",
  note = "scrolling at midnight"
) {
  await page.getByRole("button", { name: "Log urge" }).click();
  await page.getByRole("button", { name: "bored", exact: true }).click();
  await page.getByLabel("What was going on?").fill(note);
  await page.getByRole("button", { name: outcome, exact: true }).click();
}

test("a logged urge appears in tonight's timeline and survives a reload", async ({ page }) => {
  await logUrge(page, "Rode it out");

  const item = page.locator(".timeline-item");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("bored");
  await expect(item).toContainText("scrolling at midnight Rode it out.");

  await page.reload();
  await expect(page.locator(".timeline-item")).toHaveCount(1);
});

test("logging returns to Today, where the urge just appeared", async ({ page }) => {
  await page.getByRole("tab", { name: "Insights" }).click();
  await logUrge(page, "Gave in");

  await expect(page.getByRole("tab", { name: "Today" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".timeline-item")).toContainText("Gave in.");
});

test("closing the sheet without saving records nothing", async ({ page }) => {
  await page.getByRole("button", { name: "Log urge" }).click();
  await page.getByRole("button", { name: "stressed", exact: true }).click();
  await page.getByRole("button", { name: "Close without saving" }).click();

  await expect(page.locator(".sheet")).toHaveCount(0);
  await expect(page.locator(".timeline-item")).toHaveCount(0);
});

test("escape closes the sheet and hands focus back to the button that opened it", async ({
  page,
}) => {
  const fab = page.getByRole("button", { name: "Log urge" });
  await fab.click();
  await expect(page.locator(".sheet")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".sheet")).toHaveCount(0);
  await expect(fab).toBeFocused();
});

test("several urges in one night stay in time order", async ({ page }) => {
  await logUrge(page, "Rode it out", "first");
  await logUrge(page, "Gave in", "second");

  await expect(page.locator(".timeline-item")).toHaveCount(2);
  await expect(page.locator(".timeline-line").first()).toContainText("first");
});
