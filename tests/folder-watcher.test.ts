import { expect, test } from "bun:test";
import { isDirectoryChangeEvent } from "../src/hooks/use-folder-watcher";

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
