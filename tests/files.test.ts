import { expect, test } from "bun:test";
import { isVisibleTreeEntryName } from "../src/lib/files";

test("shows common dot-prefixed tool folders", () => {
  for (const name of [".agent", ".claude", ".codex", ".cursor", ".github", ".vscode"]) {
    expect(isVisibleTreeEntryName(name)).toBe(true);
  }
});

test("keeps noisy hidden entries filtered", () => {
  for (const name of [".git", ".DS_Store", ".cache", ".env"]) {
    expect(isVisibleTreeEntryName(name)).toBe(false);
  }
});

test("shows regular entries", () => {
  expect(isVisibleTreeEntryName("notes")).toBe(true);
  expect(isVisibleTreeEntryName("readme.md")).toBe(true);
});
