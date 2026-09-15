import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The stylesheet is one long file of design tokens, and a `var(--typo)` fails
 * silently: the declaration is simply dropped, with no error anywhere. That is
 * exactly the kind of thing to catch mechanically rather than by noticing a
 * colour looks slightly wrong.
 */
const CSS = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

const defined = new Set([...CSS.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]!));
const used = new Set([...CSS.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]!));

describe("design tokens", () => {
  it("defines every custom property the stylesheet uses", () => {
    expect([...used].filter((name) => !defined.has(name))).toEqual([]);
  });

  it("finds the tokens at all, so the check can't pass by reading nothing", () => {
    expect(defined.size).toBeGreaterThan(20);
    expect(used.size).toBeGreaterThan(20);
  });
});
