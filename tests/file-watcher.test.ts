import { expect, test } from "bun:test";
import type { UnwatchFn, WatchEvent } from "@tauri-apps/plugin-fs";
import {
  createFileWatcherController,
  isFileContentChangeEvent,
} from "../src/hooks/use-file-watcher";

const CONTENT_CHANGE: WatchEvent = {
  type: { modify: { kind: "data", mode: "content" } },
  paths: [],
  attrs: null,
};
const ACCESS_CHANGE: WatchEvent = {
  type: { access: { kind: "open", mode: "read" } },
  paths: [],
  attrs: null,
};

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

function fakeWatchFactory() {
  const registrations: Array<{
    path: string;
    emit: (event: WatchEvent) => void;
    resolve: () => void;
    reject: (error: unknown) => void;
    unwatchCalls: number;
  }> = [];

  const watch = (path: string, onEvent: (event: WatchEvent) => void): Promise<UnwatchFn> => {
    return new Promise<UnwatchFn>((resolve, reject) => {
      const reg = {
        path,
        emit: onEvent,
        resolve: () => resolve((() => { reg.unwatchCalls += 1; }) as UnwatchFn),
        reject,
        unwatchCalls: 0,
      };
      registrations.push(reg);
    });
  };

  return { watch, registrations };
}

function fakeScheduler() {
  const tasks = new Map<number, () => void>();
  let nextId = 1;

  return {
    schedule(fn: () => void) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, fn);
      return id;
    },
    cancel(id: unknown) {
      tasks.delete(id as number);
    },
    runAll() {
      const pending = Array.from(tasks.entries());
      tasks.clear();
      for (const [, fn] of pending) fn();
    },
    get size() {
      return tasks.size;
    },
  };
}

function flushAsyncCleanup(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("coalesces active file content changes and ignores access events", () => {
  const { watch, registrations } = fakeWatchFactory();
  const scheduler = fakeScheduler();
  let reloads = 0;

  const controller = createFileWatcherController(() => { reloads += 1; }, {
    watch,
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  controller.setPath("/notes/today.md");
  registrations[0].emit(CONTENT_CHANGE);
  registrations[0].emit(CONTENT_CHANGE);
  registrations[0].emit(ACCESS_CHANGE);

  expect(scheduler.size).toBe(1);
  scheduler.runAll();
  expect(reloads).toBe(1);
});

test("keeps stale file watcher events from reloading the new active file", async () => {
  const { watch, registrations } = fakeWatchFactory();
  const scheduler = fakeScheduler();
  let reloads = 0;

  const controller = createFileWatcherController(() => { reloads += 1; }, {
    watch,
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  controller.setPath("/notes/old.md");
  controller.setPath("/notes/new.md");

  registrations[0].emit(CONTENT_CHANGE);
  registrations[1].emit(CONTENT_CHANGE);

  scheduler.runAll();
  expect(reloads).toBe(1);

  registrations[0].resolve();
  await flushAsyncCleanup();
  expect(registrations[0].unwatchCalls).toBe(1);
});

test("dispose releases the active file watcher and cancels pending reloads", async () => {
  const { watch, registrations } = fakeWatchFactory();
  const scheduler = fakeScheduler();
  let reloads = 0;

  const controller = createFileWatcherController(() => { reloads += 1; }, {
    watch,
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  });

  controller.setPath("/notes/today.md");
  registrations[0].emit(CONTENT_CHANGE);
  expect(scheduler.size).toBe(1);

  controller.dispose();
  scheduler.runAll();
  expect(reloads).toBe(0);

  registrations[0].resolve();
  await flushAsyncCleanup();
  expect(registrations[0].unwatchCalls).toBe(1);
});
