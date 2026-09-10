import { expect, test, type Page } from "@playwright/test";
import { seedRecentDays } from "./support.ts";

/**
 * The constraints from the brief, as tests.
 *
 * These are the things that are easy to undo by accident — a colour token
 * swapped, a "nice" bit of encouragement added to an empty state, an icon in
 * the tab bar — and that nothing else in the suite would notice.
 */

/**
 * Every recognisably red colour currently painted on the page.
 *
 * Works in hue rather than on raw channels so it can tell red from the app's
 * warm sand accent, which sits around 32°.
 */
async function redsOnPage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const parse = (value: string) => {
      const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());
      if (!match) return null;
      const parts = match[1]!.split(/[,\s/]+/).filter(Boolean).map(Number);
      const [r, g, b] = parts;
      const a = parts.length > 3 ? parts[3]! : 1;
      if ([r, g, b].some((n) => n === undefined || Number.isNaN(n))) return null;
      return { r: r!, g: g!, b: b!, a };
    };

    const isRed = (value: string) => {
      const c = parse(value);
      if (!c || c.a <= 0.15) return false;
      const [r, g, b] = [c.r / 255, c.g / 255, c.b / 255];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const lightness = (max + min) / 2;
      if (delta < 0.08 || lightness < 0.12 || lightness > 0.9) return false;
      const saturation = delta / (1 - Math.abs(2 * lightness - 1));
      if (saturation < 0.25) return false;
      let hue = 0;
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      hue = (hue + 360) % 360;
      return hue <= 15 || hue >= 340;
    };

    const found: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const s = getComputedStyle(el);
      for (const prop of [
        "color",
        "backgroundColor",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
        "outlineColor",
        "fill",
        "stroke",
      ] as const) {
        const value = s[prop];
        if (typeof value === "string" && isRed(value)) {
          found.push(`${el.className || el.tagName} ${prop}: ${value}`);
        }
      }
    }
    return found;
  });
}

test.describe("the two urge outcomes carry equal weight", () => {
  test("both buttons are the same size and the same colour", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Log urge" }).click();

    const rode = page.getByRole("button", { name: "Rode it out", exact: true });
    const gave = page.getByRole("button", { name: "Gave in", exact: true });

    const styleOf = (locator: typeof rode) =>
      locator.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          color: s.color,
          background: s.backgroundColor,
          border: `${s.borderWidth} ${s.borderStyle} ${s.borderColor}`,
          font: `${s.fontFamily} ${s.fontSize} ${s.fontWeight} ${s.letterSpacing}`,
          textTransform: s.textTransform,
          opacity: s.opacity,
        };
      });

    expect(await styleOf(gave)).toEqual(await styleOf(rode));

    const [a, b] = [await rode.boundingBox(), await gave.boundingBox()];
    expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
    expect(a!.height).toBeCloseTo(b!.height, 0);
  });

  test("the same is true of the sheet opened to edit an urge", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Log urge" }).click();
    await page.getByRole("button", { name: "Gave in", exact: true }).click();
    await page.locator(".timeline-item").click();
    await expect(page.locator(".sheet-title")).toHaveText("Edit urge");

    const rode = page.getByRole("button", { name: "Rode it out", exact: true });
    const gave = page.getByRole("button", { name: "Gave in", exact: true });
    const paint = (locator: typeof rode) =>
      locator.evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.color}|${s.backgroundColor}|${s.borderColor}|${s.fontSize}|${s.fontWeight}`;
      });
    expect(await paint(gave)).toBe(await paint(rode));

    // Deleting is destructive, but it is still not styled as an alarm: this app
    // has no red in it, and a delete confirmation is not where that changes.
    expect(await redsOnPage(page), "edit sheet").toEqual([]);
    await page.getByRole("button", { name: "Delete this urge" }).click();
    await expect(page.locator(".sheet-confirm")).toBeVisible();
    expect(await redsOnPage(page), "delete confirmation").toEqual([]);
  });

  test("there is no red anywhere on the 'gave in' path", async ({ page }) => {
    // Seeded so that every chart, the headline and the timeline are all
    // actually drawn — an empty app has very little colour to get wrong.
    await seedRecentDays(page, 10, {
      mood: 3,
      sleep: 6,
      urges: [
        { id: "u", t: 23 * 60, level: 4, trigger: "tired", note: "late", alt: "", outcome: "gave" },
      ],
    });
    expect(await redsOnPage(page), "today").toEqual([]);

    await page.getByRole("button", { name: "Log urge" }).click();
    expect(await redsOnPage(page), "urge sheet").toEqual([]);

    await page.getByRole("button", { name: "Gave in", exact: true }).click();
    await expect(page.locator(".timeline-item").first()).toBeVisible();
    expect(await redsOnPage(page), "today, after giving in").toEqual([]);

    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.locator(".headline-value")).toBeVisible();
    expect(await redsOnPage(page), "insights, with every chart drawn").toEqual([]);

    await page.getByRole("tab", { name: "Archive" }).click();
    await page.locator("button.entry").first().click();
    expect(await redsOnPage(page), "reader, after giving in").toEqual([]);
  });
});

test.describe("clean days is a share, never a streak", () => {
  test("opens at 0 / 0 rather than claiming a month it has not lived", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Insights" }).click();

    // Not 30 / 30 (a perfect month nobody lived) and not 0 / 30 (a failed one
    // nobody failed): the window is the journal's own history, and there is
    // none yet.
    await expect(page.locator(".headline-value")).toHaveText("0");
    await expect(page.locator(".headline-of")).toHaveText("/ 0");
    await expect(page.locator(".headline-note")).toContainText("not a streak");
  });

  test("the window grows from first use and caps at 30", async ({ page }) => {
    await seedRecentDays(page, 1);
    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.locator(".headline-figure")).toContainText("1");
    await expect(page.locator(".headline-of")).toHaveText("/ 1");

    await seedRecentDays(page, 10);
    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.locator(".headline-of")).toHaveText("/ 10");

    await seedRecentDays(page, 40);
    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.locator(".headline-of")).toHaveText("/ 30");
    await expect(page.locator(".headline-note")).toContainText("not a streak");
  });

  test("a bad day moves the number by one, not to zero", async ({ page }) => {
    await seedRecentDays(page, 10);
    await page.getByRole("tab", { name: "Insights" }).click();
    const before = Number(await page.locator(".headline-value").textContent());

    await page.getByRole("tab", { name: "Today" }).click();
    await page.getByRole("button", { name: "Log urge" }).click();
    await page.getByRole("button", { name: "Gave in", exact: true }).click();

    await page.getByRole("tab", { name: "Insights" }).click();
    expect(Number(await page.locator(".headline-value").textContent())).toBe(before - 1);
  });

  test("no gamification vocabulary anywhere in the app", async ({ page }) => {
    await seedRecentDays(page, 10);
    const banned =
      /\bstreak of\b|\bday streak\b|\bin a row\b|🔥|\bbadge|\bXP\b|level up|congratulat|well done|keep it up|you're on|don't break/i;

    for (const tab of ["Today", "Archive", "Insights"] as const) {
      await page.getByRole("tab", { name: tab }).click();
      expect(await appVoice(page), tab).not.toMatch(banned);
    }
  });
});

/**
 * Reads the screen as the app speaks in its own voice.
 *
 * The rotating writing prompt is excluded: it is fixed copy from the brief, and
 * one of the seven ("What did today ask of you that you didn't expect?")
 * contains a word the sweep below bans. Since the prompt rotates with the day
 * number, leaving it in made this test fail one day in seven.
 */
async function appVoice(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".prompt-text").forEach((el) => el.remove());
    return clone.innerText ?? clone.textContent ?? "";
  });
}

test("empty states say what a page is for and nothing about missing days", async ({ page }) => {
  await page.goto("/");
  const scolding =
    /missed|missing|haven't|have not|didn't|did not|no entries in|behind|catch up|get back|last logged|days ago|since you/i;

  await page.getByRole("tab", { name: "Archive" }).click();
  await expect(page.locator(".entries-empty")).toHaveText(
    "Nothing here yet. What you write will collect on this page."
  );

  await page.getByRole("tab", { name: "Insights" }).click();
  await expect(page.locator(".panel-empty")).toHaveText([
    "No urges logged yet.",
    "No moods noted yet.",
    "Not enough nights recorded yet.",
  ]);

  for (const tab of ["Today", "Archive", "Insights"] as const) {
    await page.getByRole("tab", { name: tab }).click();
    expect(await appVoice(page), tab).not.toMatch(scolding);
  }
});

test("navigation is typographic — there are no icons in the app", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".tabbar svg, .tabbar img, .tabbar canvas")).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveText(["Today", "Archive", "Insights"]);

  // The only <svg> in the app is the mood chart, which is a chart, not an icon.
  await page.getByRole("tab", { name: "Insights" }).click();
  await expect(page.locator("img")).toHaveCount(0);
});

test("one accent colour, used only to mark state", async ({ page }) => {
  await page.goto("/");

  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()
  );
  expect(accent).toBe("#e0b98d");

  // An unset scale step is not accented; the chosen one is.
  const step = page.getByRole("radio", { name: "Mood 4 of 5" });
  const before = await step.evaluate((el) => getComputedStyle(el).borderColor);
  await step.click();
  const after = await step.evaluate((el) => getComputedStyle(el).borderColor);
  expect(after).not.toBe(before);
});
