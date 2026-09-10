/**
 * A stand-in for `localStorage`, so storage tests can run without a DOM.
 *
 * It also does what a real browser does in the two cases the app is written to
 * survive and jsdom won't reproduce: refusing to be read at all (private mode,
 * blocked site data) and refusing a write (out of quota).
 */
export interface FakeStorage extends Storage {
  /** Throw from `getItem`, as a blocked-storage browser does. */
  failOnRead: boolean;
  /** Throw from `setItem`, as a full quota does. */
  failOnWrite: boolean;
}

export function createStorage(): FakeStorage {
  const entries = new Map<string, string>();

  return {
    failOnRead: false,
    failOnWrite: false,

    get length() {
      return entries.size;
    },
    key(index: number) {
      return [...entries.keys()][index] ?? null;
    },
    getItem(key: string) {
      if (this.failOnRead) throw new DOMException("denied", "SecurityError");
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (this.failOnWrite) throw new DOMException("quota", "QuotaExceededError");
      entries.set(key, String(value));
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  } as FakeStorage;
}

/** Replaces the global `localStorage` with a fresh, empty stub. */
export function installStorage(): FakeStorage {
  const storage = createStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}
