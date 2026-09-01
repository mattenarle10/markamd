import { expect, test } from "bun:test";
import {
  clearUnsafeFolderRestoreState,
  isFilesystemRoot,
  STORAGE_KEYS,
} from "../src/lib/storage";
import { normalizeStartupMode } from "../src/lib/startup";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test("recognizes filesystem roots without rejecting normal folders", () => {
  expect(isFilesystemRoot("V:\\")).toBe(true);
  expect(isFilesystemRoot("v:/")).toBe(true);
  expect(isFilesystemRoot("/")).toBe(true);
  expect(isFilesystemRoot("V:\\notes")).toBe(false);
  expect(isFilesystemRoot("/Users/notes")).toBe(false);
});

test("clears both folder keys when the folders list contains a drive root", () => {
  const storage = new MemoryStorage();
  storage.values.set(STORAGE_KEYS.folders, JSON.stringify(["V:\\"]));
  storage.values.set(STORAGE_KEYS.lastFolder, JSON.stringify("V:\\notes"));
  storage.values.set(STORAGE_KEYS.lastFile, JSON.stringify("V:\\diagram.md"));

  expect(clearUnsafeFolderRestoreState(storage)).toBe(true);
  expect(storage.getItem(STORAGE_KEYS.folders)).toBeNull();
  expect(storage.getItem(STORAGE_KEYS.lastFolder)).toBeNull();
  expect(storage.getItem(STORAGE_KEYS.lastFile)).toBe(JSON.stringify("V:\\diagram.md"));
});

test("clears both folder keys when only the legacy fallback contains a root", () => {
  const storage = new MemoryStorage();
  storage.values.set(STORAGE_KEYS.folders, JSON.stringify(["V:\\notes"]));
  storage.values.set(STORAGE_KEYS.lastFolder, JSON.stringify("V:\\"));

  expect(clearUnsafeFolderRestoreState(storage)).toBe(true);
  expect(storage.getItem(STORAGE_KEYS.folders)).toBeNull();
  expect(storage.getItem(STORAGE_KEYS.lastFolder)).toBeNull();
});

test("keeps a safe folder session unchanged", () => {
  const storage = new MemoryStorage();
  const folders = JSON.stringify(["V:\\notes"]);
  const lastFolder = JSON.stringify("V:\\notes");
  storage.values.set(STORAGE_KEYS.folders, folders);
  storage.values.set(STORAGE_KEYS.lastFolder, lastFolder);

  expect(clearUnsafeFolderRestoreState(storage)).toBe(false);
  expect(storage.getItem(STORAGE_KEYS.folders)).toBe(folders);
  expect(storage.getItem(STORAGE_KEYS.lastFolder)).toBe(lastFolder);
});

test("normalizes persisted startup modes to supported values", () => {
  expect(normalizeStartupMode("blank")).toBe("blank");
  expect(normalizeStartupMode("welcome")).toBe("welcome");
  expect(normalizeStartupMode("invalid")).toBe("welcome");
  expect(normalizeStartupMode(null)).toBe("welcome");
});
