import { expect, test, type Page } from "@playwright/test";
import { entry, seed } from "./support.ts";

const DEFAULTS = ["Walk", "Read", "No phone in bed", "Water"];

const chips = (page: Page) => page.locator(".habits .habit");
const openEditor = (page: Page) => page.getByRole("button", { name: /^edit/ }).click();

test("a new journal starts with the default habits", async ({ page }) => {
  await page.goto("/");
  await expect(chips(page)).toHaveText(DEFAULTS);
});

test("a habit you name is added, tickable, and still there after a reload", async ({ page }) => {
  await page.goto("/");
  await openEditor(page);
  await page.getByLabel("Name a habit").fill("Cold shower");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(chips(page)).toHaveText([...DEFAULTS, "Cold shower"]);

  // Exact: with the editor open, "Cold shower" also matches its remove button,
  // whose accessible name is "remove Cold shower".
  const added = page.getByRole("button", { name: "Cold shower", exact: true });
  await added.click();
  await expect(added).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(chips(page)).toHaveText([...DEFAULTS, "Cold shower"]);
  await expect(
    page.getByRole("button", { name: "Cold shower", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
});

test("names are tidied on the way in", async ({ page }) => {
  await page.goto("/");
  await openEditor(page);
  await page.getByLabel("Name a habit").fill("   cold   shower   ");
  await page.getByRole("button", { name: "Add" }).click();

  await expect(chips(page).last()).toHaveText("cold shower");
});

test.describe("a habit it will not add", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await openEditor(page);
  });

  test("says so for one already on the list, whatever the case", async ({ page }) => {
    await page.getByLabel("Name a habit").fill("walk");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.locator(".habit-error")).toHaveText("That one is already here.");
    await expect(chips(page)).toHaveText(DEFAULTS);
  });

  test("says so for a blank name", async ({ page }) => {
    await page.getByLabel("Name a habit").fill("   ");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.locator(".habit-error")).toHaveText("Give the habit a name.");
    await expect(chips(page)).toHaveText(DEFAULTS);
  });

  test("clears the complaint once you start typing again", async ({ page }) => {
    await page.getByLabel("Name a habit").fill("walk");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.locator(".habit-error")).toBeVisible();

    await page.getByLabel("Name a habit").fill("walking");
    await expect(page.locator(".habit-error")).toHaveCount(0);
  });
});

test("a habit you remove goes from the row", async ({ page }) => {
  await page.goto("/");
  await openEditor(page);
  await page.getByRole("button", { name: "remove Read" }).click();

  await expect(chips(page)).toHaveText(["Walk", "No phone in bed", "Water"]);
  await page.reload();
  await expect(chips(page)).toHaveText(["Walk", "No phone in bed", "Water"]);
});

/**
 * Dropping a habit decides what to track from here. It is not permission to
 * rewrite what a past day says happened.
 */
test("a removed habit still shows on a day that had already ticked it", async ({ page }) => {
  await seed(page, {
    "2026-03-20": entry("2026-03-20", { text: "A day at the gym.", habits: ["Walk", "Gym"] }),
  });

  await openEditor(page);
  await page.getByLabel("Name a habit").fill("Gym");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "remove Gym" }).click();
  await expect(chips(page)).toHaveText(DEFAULTS);

  await page.getByRole("tab", { name: "Archive" }).click();
  await page.locator("button.entry").click();

  const reader = page.getByRole("dialog", { name: "Entry" });
  await expect(reader.locator(".habit")).toHaveText([...DEFAULTS, "Gym"]);
  await expect(reader.getByRole("button", { name: "Gym", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("habits travel with an exported copy, and merge on the way back in", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await openEditor(page);
  await page.getByLabel("Name a habit").fill("Cold shower");
  await page.getByRole("button", { name: "Add" }).click();
  await page.locator("textarea.editor").fill("So the file has a day in it.");

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

  expect(JSON.parse(backup).habits).toEqual([...DEFAULTS, "Cold shower"]);

  // A second device, with a habit of its own the file has not heard of.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL! });
  const second = await other.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: /^edit/ }).click();
  await second.getByLabel("Name a habit").fill("Stretch");
  await second.getByRole("button", { name: "Add" }).click();

  await second.getByRole("tab", { name: "Archive" }).click();
  await second.getByRole("button", { name: "Import a copy" }).click();
  await second.locator('input[type="file"]').setInputFiles({
    name: "nightly-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup, "utf8"),
  });
  await second.getByRole("button", { name: "Import", exact: true }).click();

  // Neither device loses a habit the other had not heard of.
  await second.getByRole("tab", { name: "Today" }).click();
  await expect(chips(second)).toHaveText([...DEFAULTS, "Stretch", "Cold shower"]);

  await other.close();
});

test("the habit editor keeps to the app's typography — no icons", async ({ page }) => {
  await page.goto("/");
  await openEditor(page);

  await expect(page.locator(".habit-editor")).toBeVisible();
  await expect(page.locator(".habit-editor svg, .habit-editor img")).toHaveCount(0);
});
