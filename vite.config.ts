import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** Every file under `dir`, as origin-absolute URLs. */
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? walk(full, base)
      : ["/" + relative(base, full).split("\\").join("/")];
  });
}

/**
 * Fills in the service worker's precache list.
 *
 * The worker ships as a plain file in `public/` — it has to sit at the origin
 * root to control the whole scope — but it can't know the hashed names of the
 * build output until the build has produced them. So the list is stamped in
 * afterwards, along with a build id that retires the previous caches.
 */
function serviceWorkerPrecache(): Plugin {
  return {
    name: "nightly:sw-precache",
    apply: "build",
    enforce: "post",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      const sw = resolve(dist, "sw.js");

      const urls = walk(dist)
        .filter((url) => url !== "/sw.js" && !url.endsWith(".map"))
        // The extended-Latin faces are only reached by accented characters most
        // journals never contain; leave them to be cached on first use rather
        // than making everyone pay for them at install.
        .filter((url) => !url.endsWith("-latin-ext.woff2"))
        // "/" already stands for the shell; listing index.html too would fetch
        // and store the same bytes twice.
        .filter((url) => url !== "/index.html")
        .sort();

      const buildId = createHash("sha256").update(urls.join("|")).digest("hex").slice(0, 8);
      const source = readFileSync(sw, "utf8")
        .replace('"__PRECACHE_URLS__"', JSON.stringify(urls, null, 2))
        .replace("__BUILD_ID__", buildId);

      writeFileSync(sw, source);
      this.info?.(`service worker precaching ${urls.length} files (build ${buildId})`);
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerPrecache()],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
  },
});
