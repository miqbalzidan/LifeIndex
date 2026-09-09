import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("an entry survives a reload", async ({ page }) => {
  const entry = "Walked home the long way. It helped more than I expected.";

  await page.locator("textarea.editor").fill(entry);
  await expect(page.locator(".word-count")).toHaveText("11 words");

  await page.reload();
  await expect(page.locator("textarea.editor")).toHaveValue(entry);
});

test("mood, energy, sleep and habits survive a reload", async ({ page }) => {
  await page.getByRole("radio", { name: "Mood 4 of 5" }).click();
  await page.getByRole("radio", { name: "Energy 2 of 5" }).click();
  await page.getByRole("button", { name: "Half an hour less sleep" }).click(); // records 7
  await page.getByRole("button", { name: "Half an hour less sleep" }).click(); // steps to 6.5
  await page.getByRole("button", { name: "Walk" }).click();

  await page.reload();

  await expect(page.getByRole("radio", { name: "Mood 4 of 5" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await expect(page.getByRole("radio", { name: "Energy 2 of 5" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await expect(page.locator(".stepper-value")).toHaveText("6.5 h");
  await expect(page.getByRole("button", { name: "Walk" })).toHaveAttribute("aria-pressed", "true");
});

test("the writing prompt steps aside as soon as there is writing", async ({ page }) => {
  await expect(page.locator(".prompt-row")).toBeVisible();

  await page.locator("textarea.editor").fill("Something.");
  await expect(page.locator(".prompt-row")).toHaveCount(0);

  // And comes back if the page is emptied again — it was never dismissed.
  await page.locator("textarea.editor").fill("");
  await expect(page.locator(".prompt-row")).toBeVisible();
});

test("skipping the prompt offers a different one, and remembers", async ({ page }) => {
  const prompt = page.locator(".prompt-text");
  const first = await prompt.textContent();

  await page.getByRole("button", { name: /skip/ }).click();
  const second = await prompt.textContent();
  expect(second).not.toBe(first);

  await page.reload();
  await expect(prompt).toHaveText(second!);
});

test("a day that was only opened leaves nothing behind", async ({ page }) => {
  await page.getByRole("tab", { name: "Archive" }).click();
  await expect(page.locator("button.entry")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("nightly.journal.v1"))).toBeNull();
});

test.describe("sleep is recorded, not assumed", () => {
  test("stays blank until a night is actually entered", async ({ page }) => {
    const value = page.locator(".stepper-value");
    await expect(value).toContainText("—");

    // The first press writes down the default rather than stepping away from it.
    await page.getByRole("button", { name: "Half an hour more sleep" }).click();
    await expect(value).toContainText("7 h");
    await page.getByRole("button", { name: "Half an hour more sleep" }).click();
    await expect(value).toContainText("7.5 h");

    await page.reload();
    await expect(page.locator(".stepper-value")).toContainText("7.5 h");
  });

  test("an entry with no sleep entered adds no night to the sleep chart", async ({ page }) => {
    await page.locator("textarea.editor").fill("Wrote tonight, never touched the stepper.");

    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.locator(".panel").last()).toContainText("Not enough nights recorded yet.");

    // And the reader does not claim a night of seven hours either.
    await page.getByRole("tab", { name: "Archive" }).click();
    await page.locator("button.entry").click();
    await expect(page.getByRole("dialog", { name: "Entry" }).locator(".reader-meta")).toHaveText("");
  });

  test("a recorded night does reach the chart", async ({ page }) => {
    await page.getByRole("button", { name: "Half an hour less sleep" }).click(); // 7
    await page.getByRole("button", { name: "Half an hour less sleep" }).click(); // 6.5

    await page.getByRole("tab", { name: "Insights" }).click();
    const sleepPanel = page.locator(".panel").last();
    await expect(sleepPanel).not.toContainText("Not enough nights recorded yet.");
    await expect(sleepPanel.locator(".sleep-row")).toHaveCount(3);
  });
});
