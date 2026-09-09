import { beforeEach } from "vitest";
import { installStorage } from "./localStorage.ts";

// A fresh, empty storage per test, so no test can see what another one wrote.
// Tests that need a handle on it call `installStorage()` again themselves.
beforeEach(() => {
  installStorage();
});
