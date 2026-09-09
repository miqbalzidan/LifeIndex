import { expect, test } from "@playwright/test";
import { entry, seed } from "./support.ts";

test("entries list newest first and open in the reader", async ({ page }) => {
  await seed(page, {
    "2026-01-04": entry("2026-01-04", { text: "The oldest of the three entries." }),
    "2026-02-11": entry("2026-02-11", { text: "A middle entry about a cold walk." }),
    "2026-03-20": entry("2026-03-20", { text: "The newest entry, about rain." }),
  });

  await page.getByRole("tab", { name: "Archive" }).click();
  const entries = page.locator("button.entry");
  await expect(entries).toHaveCount(3);
  await expect(entries.first()).toContainText("The newest entry");

  await entries.first().click();
  const reader = page.getByRole("dialog", { name: "Entry" });
  await expect(reader).toBeVisible();
  await expect(reader).toContainText("The newest entry, about rain.");

  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
});

test("search narrows to matches, reports a miss, and clears", async ({ page }) => {
  await seed(page, {
    "2026-02-11": entry("2026-02-11", { text: "A middle entry about a cold walk." }),
    "2026-03-20": entry("2026-03-20", { text: "The newest entry, about rain." }),
  });
  await page.getByRole("tab", { name: "Archive" }).click();

  const search = page.getByLabel("Search entries");
  await search.fill("cold walk");
  await expect(page.locator("button.entry")).toHaveCount(1);

  // Case-insensitive.
  await search.fill("COLD WALK");
  await expect(page.locator("button.entry")).toHaveCount(1);

  await search.fill("nothing matches this");
  await expect(page.locator("button.entry")).toHaveCount(0);
  await expect(page.locator(".entries-empty")).toHaveText("Nothing here for that word. Try another.");

  await search.fill("");
  await expect(page.locator("button.entry")).toHaveCount(2);
});

test("'on this day' surfaces a month and a year back, and hides while searching", async ({
  page,
}) => {
  // Built from the browser's own clock so the fixture stays valid every day.
  const dates = await page.evaluate(() => {
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const back = (months: number) => {
      const m = now.getMonth() - months;
      const lastDay = new Date(now.getFullYear(), m + 1, 0).getDate();
      return iso(new Date(now.getFullYear(), m, Math.min(now.getDate(), lastDay)));
    };
    return { month: back(1), year: back(12) };
  });

  await seed(page, {
    [dates.month]: entry(dates.month, { text: "One month back, a note about the garden." }),
    [dates.year]: entry(dates.year, { text: "One year back, a note about moving house." }),
  });
  await page.getByRole("tab", { name: "Archive" }).click();

  const onThisDay = page.locator(".on-this-day");
  await expect(onThisDay).toContainText("One month ago");
  await expect(onThisDay).toContainText("One year ago");

  await page.getByLabel("Search entries").fill("garden");
  await expect(onThisDay).toHaveCount(0);
});

test("a day with urges but no writing is still readable", async ({ page }) => {
  await seed(page, {
    "2026-03-20": entry("2026-03-20", {
      urges: [
        { id: "a", t: 1345, level: 4, trigger: "tired", note: "late", alt: "", outcome: "gave" },
      ],
    }),
  });
  await page.getByRole("tab", { name: "Archive" }).click();

  await expect(page.locator("button.entry")).toContainText("No entry — 1 urge logged.");
  await page.locator("button.entry").click();
  const reader = page.getByRole("dialog", { name: "Entry" });
  await expect(reader).toContainText("No writing this day.");
  await expect(reader).toContainText("tired · 4/5 · late Gave in.");
});
