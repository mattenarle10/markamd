import { expect, test } from "bun:test";
import { isFileContentChangeEvent } from "../src/hooks/use-file-watcher";

test("reloads for file create, remove, and content changes", () => {
  expect(isFileContentChangeEvent({ type: { create: { kind: "file" } }, paths: [], attrs: null })).toBe(true);
  expect(isFileContentChangeEvent({ type: { remove: { kind: "file" } }, paths: [], attrs: null })).toBe(true);
  expect(isFileContentChangeEvent({ type: { modify: { kind: "data", mode: "content" } }, paths: [], attrs: null })).toBe(true);
});

test("ignores access, metadata, and unrelated events", () => {
  expect(isFileContentChangeEvent({ type: { access: { kind: "open", mode: "read" } }, paths: [], attrs: null })).toBe(false);
  expect(isFileContentChangeEvent({ type: { modify: { kind: "metadata", mode: "permissions" } }, paths: [], attrs: null })).toBe(false);
  expect(isFileContentChangeEvent({ type: "other", paths: [], attrs: null })).toBe(false);
});
