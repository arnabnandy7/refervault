import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { THEME_INITIALIZATION_SCRIPT, THEME_STORAGE_KEY } from "../lib/theme";

function initializeTheme(savedTheme: string | null, prefersDark: boolean) {
  const documentElement = { dataset: {}, style: {} };

  vm.runInNewContext(THEME_INITIALIZATION_SCRIPT, {
    document: { documentElement },
    localStorage: {
      getItem(key: string) {
        assert.equal(key, THEME_STORAGE_KEY);
        return savedTheme;
      },
    },
    matchMedia(query: string) {
      assert.equal(query, "(prefers-color-scheme: dark)");
      return { matches: prefersDark };
    },
  });

  return documentElement;
}

test("uses the operating-system theme on first visit", () => {
  assert.deepEqual(initializeTheme(null, true), {
    dataset: { theme: "dark" },
    style: { colorScheme: "dark" },
  });
  assert.deepEqual(initializeTheme(null, false), {
    dataset: { theme: "light" },
    style: { colorScheme: "light" },
  });
});

test("uses a saved preference instead of the operating-system theme", () => {
  assert.deepEqual(initializeTheme("light", true), {
    dataset: { theme: "light" },
    style: { colorScheme: "light" },
  });
  assert.deepEqual(initializeTheme("dark", false), {
    dataset: { theme: "dark" },
    style: { colorScheme: "dark" },
  });
});
