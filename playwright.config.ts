import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  // Serial on CI so the shared preview server is not the bottleneck.
  ...(process.env["CI"] ? { workers: 1 } : {}),
  reporter: process.env["CI"] ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },

  // The app is designed at 390px and installed to a phone, so that is the width
  // it gets tested at.
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],

  // Against the built app, not the dev server: the service worker's precache
  // list is stamped in at build time, so offline behaviour only exists here.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
