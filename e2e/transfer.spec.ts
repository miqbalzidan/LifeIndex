import { expect, test, type Page } from "@playwright/test";
import { entry, seed } from "./support.ts";

const KEY = "nightly.journal.v1";

const openArchive = async (page: Page) => page.getByRole("tab", { name: "Archive" }).click();

/** Hands the hidden file input a JSON file, as the file picker would. */
async function chooseFile(page: Page, name: string, contents: string) {
  await page.getByRole("button", { name: "Import a copy" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(contents, "utf8"),
  });
}

test("exports the journal as a dated JSON file", async ({ page }) => {
  await seed(page, {
    "2026-03-20": entry("2026-03-20", { text: "The entry to get back.", mood: 4, sleep: 6.5 }),
  });
  await openArchive(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export a copy" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^nightly-\d{4}-\d{2}-\d{2}\.json$/);

  const stream = await download.createReadStream();
  const text = await new Promise<string>((resolve, reject) => {
    let out = "";
    stream.on("data", (chunk) => (out += chunk));
    stream.on("end", () => resolve(out));
    stream.on("error", reject);
  });

  const file = JSON.parse(text);
  expect(file.format).toBe("nightly.journal");
  expect(file.version).toBe(1);
  expect(file.days["2026-03-20"].text).toBe("The entry to get back.");
  expect(file.days["2026-03-20"].sleep).toBe(6.5);
});

/**
 * The case the whole feature is for: the browser's site data is cleared and
 * the journal is gone, because there is no server that kept a copy.
 */
test("a copy survives the site data being cleared", async ({ page, browser }) => {
  await page.goto("/");
  await page.locator("textarea.editor").fill("The night I do not want to lose.");
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), KEY))
    .toContain("do not want to lose");

  await openArchive(page);
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

  // A context of its own, with nothing stored in it: the same standing start as
  // a browser whose site data has been cleared, or a new phone. (Clearing the
  // key under the running app does not simulate it — the app flushes its own
  // state back on the way out, and lands on top.)
  const cleared = await browser.newContext({ baseURL: test.info().project.use.baseURL! });
  const fresh = await cleared.newPage();
  await fresh.goto("/");
  await openArchive(fresh);
  await expect(fresh.locator("button.entry")).toHaveCount(0);

  await chooseFile(fresh, "nightly-backup.json", backup);
  await expect(fresh.locator(".transfer-confirm")).toContainText("1 day in that file.");
  await fresh.getByRole("button", { name: "Import", exact: true }).click();

  await expect(fresh.locator(".transfer-message")).toHaveText("Imported 1 day.");
  await expect(fresh.locator("button.entry")).toContainText("The night I do not want to lose.");

  // And it is on the device again, not just on screen.
  await fresh.reload();
  await openArchive(fresh);
  await expect(fresh.locator("button.entry")).toContainText("The night I do not want to lose.");

  await cleared.close();
});

test("says what an import will overwrite, and does nothing until confirmed", async ({ page }) => {
  await seed(page, {
    "2026-03-20": entry("2026-03-20", { text: "What this device has." }),
  });
  await openArchive(page);

  const incoming = JSON.stringify({
    format: "nightly.journal",
    version: 1,
    days: {
      "2026-03-20": { date: "2026-03-20", text: "What the file has.", urges: [] },
      "2026-03-21": { date: "2026-03-21", text: "A day only the file has.", urges: [] },
    },
    promptSkips: 0,
  });

  await chooseFile(page, "copy.json", incoming);
  const confirm = page.locator(".transfer-confirm");
  await expect(confirm).toContainText("2 days in that file.");
  await expect(confirm).toContainText("1 day already here will be replaced");

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.locator("button.entry")).toHaveCount(1);
  await expect(page.locator("button.entry")).toContainText("What this device has.");

  await chooseFile(page, "copy.json", incoming);
  await page.getByRole("button", { name: "Import", exact: true }).click();

  const entries = page.locator("button.entry");
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText("A day only the file has.");
  await expect(entries.last()).toContainText("What the file has.");
});

test("keeps days the file does not have", async ({ page }) => {
  await seed(page, {
    "2026-03-01": entry("2026-03-01", { text: "Only on this device." }),
    "2026-03-20": entry("2026-03-20", { text: "On both." }),
  });
  await openArchive(page);

  await chooseFile(
    page,
    "copy.json",
    JSON.stringify({
      format: "nightly.journal",
      days: { "2026-03-20": { date: "2026-03-20", text: "From the file.", urges: [] } },
    })
  );
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.locator("button.entry")).toHaveCount(2);
  await expect(page.locator("button.entry").last()).toContainText("Only on this device.");
});

test.describe("a file it cannot use", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, { "2026-03-20": entry("2026-03-20", { text: "Still here afterwards." }) });
    await openArchive(page);
  });

  for (const [name, contents, expected] of [
    ["not JSON", "{ nope", "That file isn't readable as JSON."],
    ["from another app", JSON.stringify({ format: "other.app" }), "That file isn't a Nightly export."],
    [
      "from a newer Nightly",
      JSON.stringify({ format: "nightly.journal", version: 99, days: {} }),
      "That file was written by a newer version of Nightly.",
    ],
    [
      "empty",
      JSON.stringify({ format: "nightly.journal", version: 1, days: {} }),
      "There are no entries in that file.",
    ],
  ] as const) {
    test(`says why it cannot read a file that is ${name}, and changes nothing`, async ({ page }) => {
      await chooseFile(page, "bad.json", contents);

      await expect(page.locator(".transfer-message")).toHaveText(expected);
      await expect(page.locator(".transfer-confirm")).toHaveCount(0);
      await expect(page.locator("button.entry")).toContainText("Still here afterwards.");
    });
  }
});
