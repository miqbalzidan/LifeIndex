/**
 * Nightly's service worker.
 *
 * The journal itself never comes through here — it lives in localStorage and
 * never leaves the device. This only makes the app itself openable offline,
 * which for something used at night, in bed, on bad wifi, is most of the point
 * of installing it.
 *
 * Hand-written rather than generated: the caching story is three rules long and
 * a build plugin would be more machinery than the whole app.
 */

/**
 * Both of these are filled in at build time by the `nightly:sw-precache` plugin
 * in vite.config.ts — the hashed filenames don't exist until the build has run.
 * In the unbuilt source they are just a placeholder and an empty list.
 */
const VERSION = "__BUILD_ID__";
const PRECACHE_URLS = "__PRECACHE_URLS__";

const SHELL = `nightly-shell-${VERSION}`;
const ASSETS = `nightly-assets-${VERSION}`;

/** The shell, plus everything the build emitted: the whole app, offline. */
const SHELL_URLS = ["/", ...(Array.isArray(PRECACHE_URLS) ? PRECACHE_URLS : [])];

/**
 * Static hosts commonly answer with `Vary: Origin`, and Vite marks its module
 * scripts `crossorigin`, so the browser's request for a bundle carries an
 * `Origin` header that the precached copy was not stored with. Left to the
 * default rules that counts as a miss and the whole app falls over offline
 * while sitting in the cache. Precached files are content-addressed, so
 * matching on the URL alone is what we actually want here.
 */
const MATCH = { ignoreVary: true };

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // `reload` so an install never re-blesses a stale HTTP-cached shell.
      .then((cache) => cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: prefer the network so a deployed update is picked up on the
  // next launch, but fall back to the cached shell when there isn't one.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/", MATCH).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Everything else — hashed JS/CSS, fonts, icons — is content-addressed or
  // effectively static, so serve from cache and fill in on first miss.
  event.respondWith(
    caches.match(request, MATCH).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(ASSETS).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
