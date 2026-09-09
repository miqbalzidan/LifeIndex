import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * The service worker runs the offline story, and the parts of it that matter
 * most are the ones a browser test cannot reach: what happens when the network
 * answers with something that is not the app.
 *
 * It ships as a plain file rather than a module, so it is loaded here the way
 * the browser loads it — evaluated against a `self` — with the same precache
 * list stamping the build does.
 */

const ORIGIN = "https://nightly.example";
const SOURCE = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const PRECACHED = ["/assets/index-abc123.js", "/assets/index-def456.css"];

const urlOf = (request: unknown): string => {
  const value = typeof request === "string" ? request : (request as { url: string }).url;
  return new URL(value, ORIGIN).href;
};

class FakeCache {
  readonly entries = new Map<string, Response>();

  async put(request: unknown, response: Response) {
    this.entries.set(urlOf(request), response);
  }
  async match(request: unknown) {
    return this.entries.get(urlOf(request));
  }
  async addAll(requests: unknown[]) {
    for (const request of requests) {
      this.entries.set(urlOf(request), new Response(`precached ${urlOf(request)}`));
    }
  }
}

/**
 * A browser resolves a request URL against the worker's scope; Node's `Request`
 * has no document to resolve against and rejects "/" outright.
 */
class ScopedRequest {
  readonly url: string;
  readonly method: string;
  readonly mode: string;
  constructor(input: string | { url: string }, init: { method?: string; mode?: string } = {}) {
    this.url = urlOf(input);
    this.method = init.method ?? "GET";
    this.mode = init.mode ?? "no-cors";
  }
}

interface FetchEvent {
  request: unknown;
  respondWith: (response: Promise<Response> | Response) => void;
  settled: () => Promise<Response | undefined>;
}

function loadWorker() {
  const listeners = new Map<string, (event: never) => void>();
  const stores = new Map<string, FakeCache>();

  const caches = {
    async open(name: string) {
      const existing = stores.get(name) ?? new FakeCache();
      stores.set(name, existing);
      return existing;
    },
    async match(request: unknown) {
      for (const store of stores.values()) {
        const hit = await store.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };

  let respond: (request: unknown) => Promise<Response> = async () => new Response("default");

  const self = {
    addEventListener: (type: string, fn: (event: never) => void) => listeners.set(type, fn),
    location: { origin: ORIGIN },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };

  // The build stamps these in; without it the worker precaches nothing and the
  // test would be exercising a shape that never ships.
  const stamped = SOURCE.replace('"__PRECACHE_URLS__"', JSON.stringify(PRECACHED)).replace(
    "__BUILD_ID__",
    "testbuild"
  );

  new Function("self", "caches", "fetch", "Response", "Request", "URL", stamped)(
    self,
    caches,
    (request: unknown) => respond(request),
    Response,
    ScopedRequest,
    URL
  );

  return {
    caches,
    stores,
    setNetwork(fn: (request: unknown) => Promise<Response>) {
      respond = fn;
    },
    async install() {
      const waits: Promise<unknown>[] = [];
      listeners.get("install")?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) } as never);
      await Promise.all(waits);
    },
    async activate() {
      const waits: Promise<unknown>[] = [];
      listeners.get("activate")?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) } as never);
      await Promise.all(waits);
    },
    async handle(request: unknown): Promise<Response | undefined> {
      let responded: Promise<Response> | undefined;
      const event: FetchEvent = {
        request,
        respondWith: (r) => {
          responded = Promise.resolve(r);
        },
        settled: async () => responded && (await responded),
      };
      listeners.get("fetch")?.(event as never);
      return event.settled();
    },
    shell() {
      return stores.get("nightly-shell-testbuild");
    },
  };
}

const navigation = { url: `${ORIGIN}/`, method: "GET", mode: "navigate" };
const asset = { url: `${ORIGIN}${PRECACHED[0]}`, method: "GET", mode: "no-cors" };

/** A response that looks like it came from our own origin. */
const basic = (body: string, status = 200) => {
  const response = new Response(body, { status });
  Object.defineProperty(response, "type", { value: "basic" });
  return response;
};

let worker: ReturnType<typeof loadWorker>;
beforeEach(async () => {
  worker = loadWorker();
  await worker.install();
});

describe("install", () => {
  it("precaches the shell and everything the build emitted", async () => {
    const shell = worker.shell()!;
    expect([...shell.entries.keys()]).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}${PRECACHED[0]}`,
      `${ORIGIN}${PRECACHED[1]}`,
    ]);
  });
});

describe("activate", () => {
  it("retires caches from a previous build and keeps this one's", async () => {
    await worker.caches.open("nightly-shell-oldbuild");
    await worker.caches.open("nightly-assets-testbuild");
    await worker.activate();

    expect([...worker.stores.keys()].sort()).toEqual([
      "nightly-assets-testbuild",
      "nightly-shell-testbuild",
    ]);
  });
});

describe("navigations", () => {
  it("prefers the network, so a deployed update is picked up", async () => {
    worker.setNetwork(async () => basic("<html>new build</html>"));
    const response = await worker.handle(navigation);

    expect(await response!.text()).toBe("<html>new build</html>");
    expect(await worker.shell()!.entries.get(`${ORIGIN}/`)!.text()).toBe("<html>new build</html>");
  });

  it("falls back to the cached shell when there is no network", async () => {
    worker.setNetwork(async () => {
      throw new TypeError("offline");
    });
    const response = await worker.handle(navigation);
    expect(await response!.text()).toBe(`precached ${ORIGIN}/`);
  });

  it.each([404, 500, 502])(
    "does not let a %i replace the cached shell with an error page",
    async (status) => {
      worker.setNetwork(async () => basic("<html>error page</html>", status));

      // The page still sees the real answer...
      const response = await worker.handle(navigation);
      expect(response!.status).toBe(status);

      // ...but the shell that opens offline is untouched.
      expect(await worker.shell()!.entries.get(`${ORIGIN}/`)!.text()).toBe(`precached ${ORIGIN}/`);
    }
  );

  it("does not cache a response from somewhere other than this origin", async () => {
    const opaque = new Response("<html>interstitial</html>");
    Object.defineProperty(opaque, "type", { value: "opaque" });
    worker.setNetwork(async () => opaque);

    await worker.handle(navigation);
    expect(await worker.shell()!.entries.get(`${ORIGIN}/`)!.text()).toBe(`precached ${ORIGIN}/`);
  });
});

describe("assets", () => {
  it("serves a precached file without touching the network", async () => {
    worker.setNetwork(async () => {
      throw new Error("the network should not have been used");
    });
    const response = await worker.handle(asset);
    expect(await response!.text()).toBe(`precached ${ORIGIN}${PRECACHED[0]}`);
  });

  it("fetches and keeps a file it does not have yet", async () => {
    worker.setNetwork(async () => basic("body { color: red }"));
    const request = { url: `${ORIGIN}/fonts/late.woff2`, method: "GET", mode: "no-cors" };

    expect(await (await worker.handle(request))!.text()).toBe("body { color: red }");
    expect(await worker.caches.match(request)).toBeDefined();
  });

  it("does not keep a file the server could not give it", async () => {
    worker.setNetwork(async () => basic("not found", 404));
    const request = { url: `${ORIGIN}/fonts/missing.woff2`, method: "GET", mode: "no-cors" };

    await worker.handle(request);
    expect(await worker.caches.match(request)).toBeUndefined();
  });
});

describe("requests it stays out of", () => {
  it.each([
    ["a POST", { url: `${ORIGIN}/`, method: "POST", mode: "navigate" }],
    ["another origin", { url: "https://elsewhere.example/x.js", method: "GET", mode: "no-cors" }],
  ])("ignores %s entirely", async (_name, request) => {
    expect(await worker.handle(request)).toBeUndefined();
  });
});
