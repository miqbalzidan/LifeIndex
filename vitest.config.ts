import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // `src/lib` is pure logic over `Date` and `localStorage`; neither needs a
    // DOM, and a stub for the latter (test/localStorage.ts) can do the one
    // thing jsdom makes awkward — refuse to work, the way a browser in private
    // mode does.
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // Run west of Greenwich by default. Every date in this app is built from
    // local components precisely so that late-evening entries file under the
    // right night; a suite run in UTC would pass whether or not that held.
    env: { TZ: "America/Los_Angeles" },
  },
});
