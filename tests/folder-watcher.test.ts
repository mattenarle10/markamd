import { expect, test } from "bun:test";
import {
  isDirectoryChangeEvent,
  watchableFolderPaths,
} from "../src/hooks/use-folder-watcher";

test("does not recursively watch filesystem roots", () => {
  expect(watchableFolderPaths(["V:\\", "V:\\notes", "V:\\notes", "/"])).toEqual([
    "V:\\notes",
  ]);
});

test("refreshes the tree for folder creation, removal, and rename events", () => {
  expect(isDirectoryChangeEvent({ type: { create: { kind: "folder" } }, paths: [], attrs: null })).toBe(true);
  expect(isDirectoryChangeEvent({ type: { remove: { kind: "file" } }, paths: [], attrs: null })).toBe(true);
  expect(isDirectoryChangeEvent({ type: { modify: { kind: "rename", mode: "both" } }, paths: [], attrs: null })).toBe(true);
});

test("ignores file content and access events for tree refreshes", () => {
  expect(isDirectoryChangeEvent({ type: { modify: { kind: "data", mode: "content" } }, paths: [], attrs: null })).toBe(false);
  expect(isDirectoryChangeEvent({ type: { access: { kind: "open", mode: "read" } }, paths: [], attrs: null })).toBe(false);
  expect(isDirectoryChangeEvent({ type: "other", paths: [], attrs: null })).toBe(false);
});
