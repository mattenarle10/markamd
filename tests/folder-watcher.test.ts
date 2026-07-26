import { expect, test } from "bun:test";
import type { UnwatchFn, WatchEvent } from "@tauri-apps/plugin-fs";
import {
  createFolderWatcherController,
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

// --- controller lifecycle -------------------------------------------------

const RELEVANT: WatchEvent = { type: { create: { kind: "folder" } }, paths: [], attrs: null };
const IRRELEVANT: WatchEvent = { type: { modify: { kind: "data", mode: "content" } }, paths: [], attrs: null };

/** Test double for watchImmediate: records registrations, exposes each
 *  watcher's event callback, resolves/rejects on demand. */
function fakeWatchFactory() {
  type Registration = {
    path: string;
    emit: (event: WatchEvent) => void;
    resolve: () => void;
    reject: (err: unknown) => void;
    unwatchCalls: number;
  };
  const registrations: Registration[] = [];
  const watch = (path: string, onEvent: (event: WatchEvent) => void): Promise<UnwatchFn> => {
    return new Promise<UnwatchFn>((resolve, reject) => {
      const reg: Registration = {
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

/** Manual scheduler: captured timers fire only when run() is called.
 *  Counts schedule/cancel calls so tests can pin fixed-window semantics —
 *  a trailing-edge (cancel-and-reschedule) implementation would show
 *  scheduleCalls > 1 and cancelCalls > 0 for an event burst. */
function fakeScheduler() {
  const timers = new Map<number, () => void>();
  let nextId = 1;
  let scheduleCalls = 0;
  let cancelCalls = 0;
  return {
    schedule: (fn: () => void) => {
      scheduleCalls += 1;
      const id = nextId++;
      timers.set(id, fn);
      return id;
    },
    cancel: (id: unknown) => {
      cancelCalls += 1;
      timers.delete(id as number);
    },
    run: () => {
      const pending = [...timers.values()];
      timers.clear();
      for (const fn of pending) fn();
    },
    get size() {
      return timers.size;
    },
    get scheduleCalls() {
      return scheduleCalls;
    },
    get cancelCalls() {
      return cancelCalls;
    },
  };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeController(opts?: { onChange?: () => void }) {
  const { watch, registrations } = fakeWatchFactory();
  const scheduler = fakeScheduler();
  let changes = 0;
  const controller = createFolderWatcherController(
    () => {
      changes += 1;
      opts?.onChange?.();
    },
    { watch, schedule: scheduler.schedule, cancel: scheduler.cancel },
  );
  return { controller, registrations, scheduler, changes: () => changes };
}

test("controller reconciles incrementally: unchanged paths keep their watcher", async () => {
  const { controller, registrations } = makeController();
  controller.setPaths(["/a"]);
  expect(registrations.map((r) => r.path)).toEqual(["/a"]);
  registrations[0].resolve();
  await tick();

  controller.setPaths(["/a", "/b"]);
  expect(registrations.map((r) => r.path)).toEqual(["/a", "/b"]); // /a NOT re-registered
  registrations[1].resolve();
  await tick();

  controller.setPaths(["/b"]);
  await tick();
  expect(registrations[0].unwatchCalls).toBe(1); // /a released exactly once
  expect(registrations[1].unwatchCalls).toBe(0); // /b untouched
});

test("controller coalesces event bursts into one refresh per window", async () => {
  const { controller, registrations, scheduler, changes } = makeController();
  controller.setPaths(["/a"]);
  registrations[0].resolve();
  await tick();

  registrations[0].emit(RELEVANT);
  registrations[0].emit(RELEVANT);
  registrations[0].emit(RELEVANT);
  // fixed window: ONE schedule for the burst, and the original timer is never
  // cancelled/rescheduled — a trailing-edge debounce would fail both counts
  expect(scheduler.scheduleCalls).toBe(1);
  expect(scheduler.cancelCalls).toBe(0);
  expect(scheduler.size).toBe(1);
  scheduler.run();
  expect(changes()).toBe(1);

  registrations[0].emit(RELEVANT); // next window opens after the last fired
  expect(scheduler.scheduleCalls).toBe(2);
  expect(scheduler.cancelCalls).toBe(0);
  scheduler.run();
  expect(changes()).toBe(2);
});

test("controller ignores irrelevant events and stale watchers", async () => {
  const { controller, registrations, scheduler, changes } = makeController();
  controller.setPaths(["/a"]);
  registrations[0].resolve();
  await tick();

  registrations[0].emit(IRRELEVANT);
  expect(scheduler.size).toBe(0);

  controller.setPaths([]); // remove /a
  registrations[0].emit(RELEVANT); // late event from the removed watcher
  expect(scheduler.size).toBe(0);
  expect(changes()).toBe(0);
});

test("controller retries a failed registration on the next reconciliation", async () => {
  const { controller, registrations } = makeController();
  controller.setPaths(["/a"]);
  registrations[0].reject(new Error("permission denied"));
  await tick();

  controller.setPaths(["/a", "/b"]);
  expect(registrations.map((r) => r.path)).toEqual(["/a", "/a", "/b"]); // /a retried
});

test("failed registration does not evict a newer watcher for the same path", async () => {
  const { controller, registrations } = makeController();
  controller.setPaths(["/a"]);
  controller.setPaths([]); // remove while first registration still pending
  controller.setPaths(["/a"]); // re-add — second registration
  expect(registrations.length).toBe(2);

  registrations[0].reject(new Error("late failure of the removed watcher"));
  registrations[1].resolve();
  await tick();

  registrations[1].emit(RELEVANT); // newer watcher must still be live
  controller.setPaths(["/a"]); // reconcile — must NOT re-register (still current)
  expect(registrations.length).toBe(2);
});

test("events from a replaced watcher are ignored; the replacement still fires", async () => {
  const { controller, registrations, scheduler, changes } = makeController();
  controller.setPaths(["/a"]);
  registrations[0].resolve();
  await tick();

  controller.setPaths([]); // remove /a
  controller.setPaths(["/a"]); // re-add — new registration for the SAME path
  registrations[1].resolve();
  await tick();

  // a registry.has(path)-style guard would wrongly accept this stale emit —
  // only promise identity distinguishes old from new watcher on the same path
  registrations[0].emit(RELEVANT);
  expect(scheduler.size).toBe(0);
  expect(changes()).toBe(0);

  registrations[1].emit(RELEVANT); // the current watcher still fires
  scheduler.run();
  expect(changes()).toBe(1);
});

test("dispose releases watchers, cancels timers, and goes terminal", async () => {
  const { controller, registrations, scheduler, changes } = makeController();
  controller.setPaths(["/a"]);
  registrations[0].resolve();
  await tick();

  registrations[0].emit(RELEVANT);
  expect(scheduler.size).toBe(1);

  controller.dispose();
  expect(scheduler.size).toBe(0); // pending refresh cancelled
  await tick();
  expect(registrations[0].unwatchCalls).toBe(1);

  registrations[0].emit(RELEVANT); // events after dispose are inert
  expect(scheduler.size).toBe(0);
  controller.setPaths(["/b"]); // setPaths after dispose is inert
  expect(registrations.length).toBe(1);
  expect(changes()).toBe(0);
});

test("unwatch runs even when the path is removed before registration resolves", async () => {
  const { controller, registrations } = makeController();
  controller.setPaths(["/a"]);
  controller.setPaths([]); // removed while pending
  registrations[0].resolve(); // native watcher comes up late
  await tick();
  expect(registrations[0].unwatchCalls).toBe(1); // still released
});
