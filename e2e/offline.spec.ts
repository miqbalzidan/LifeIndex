import { expect, test } from "@playwright/test";

/**
 * The point of installing this app is that it opens at night, in bed, on bad
 * wifi. That means a *cold* start with no network: a fresh page, nothing in
 * memory, everything served by the service worker out of its precache.
 */
test("opens from cold with no network, with the journal intact", async ({ page, context }) => {
  await page.goto("/");
  await page.locator("textarea.editor").fill("Written while online.");
  await expect(page.locator(".word-count")).toHaveText("3 words");

  // Writing is persisted on a trailing debounce. The first page stays open
  // here, so nothing flushes it early — wait for it to actually land.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("nightly.journal.v1")))
    .toContain("Written while online.");

  // And wait for the worker to finish installing before cutting the network.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);

  const cold = await context.newPage();
  const response = await cold.goto("/");
  expect(response?.status()).toBe(200);

  await expect(cold.locator("h1.today-date")).toBeVisible();
  await expect(cold.locator("textarea.editor")).toHaveValue("Written while online.");

  // Not just the shell: the fonts and styles are precached too, so it does not
  // come up unstyled.
  await expect(cold.locator(".fab")).toHaveCSS("position", "fixed");
});

test("still records an entry while offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);

  await page.locator("textarea.editor").fill("Written on a plane.");
  await page.getByRole("button", { name: "Log urge" }).click();
  await page.getByRole("button", { name: "Rode it out", exact: true }).click();
  await expect(page.locator(".timeline-item")).toHaveCount(1);

  await page.reload();
  await expect(page.locator("textarea.editor")).toHaveValue("Written on a plane.");
  await expect(page.locator(".timeline-item")).toHaveCount(1);
});
