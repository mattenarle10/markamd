import { useEffect, useRef } from "react";
import { watchImmediate, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";
import { isFilesystemRoot } from "@/lib/storage";

const WATCH_DEBOUNCE_MS = 350;

export function watchableFolderPaths(paths: readonly string[]): string[] {
  return Array.from(new Set(
    paths.filter((path) => path.length > 0 && !isFilesystemRoot(path)),
  ));
}

export function isDirectoryChangeEvent(event: WatchEvent): boolean {
  if (event.type === "any") return true;
  if (typeof event.type === "string") return false;
  if ("create" in event.type || "remove" in event.type) return true;
  if ("modify" in event.type) {
    return event.type.modify.kind === "any" || event.type.modify.kind === "rename";
  }
  return false;
}

type FolderWatchFn = (
  path: string,
  onEvent: (event: WatchEvent) => void,
) => Promise<UnwatchFn>;

type ScheduleFn = (fn: () => void, ms: number) => unknown;
type CancelFn = (id: unknown) => void;

export type FolderWatcherController = {
  /** Reconcile the watched set: watchers are created only for new paths and
   *  removed only for dropped ones — unchanged paths keep their watcher. */
  setPaths(paths: readonly string[]): void;
  dispose(): void;
};

export type FolderWatcherControllerOptions = {
  /** Watcher factory — injectable for tests. Defaults to recursive `watchImmediate`. */
  watch?: FolderWatchFn;
  debounceMs?: number;
  isRelevant?: (event: WatchEvent) => boolean;
  schedule?: ScheduleFn;
  cancel?: CancelFn;
};

/**
 * Watcher registry with change coalescing, extracted from the hook so the
 * lifecycle logic is unit-testable (see tests/folder-watcher.test.ts).
 *
 * Perf-critical details:
 *  - `watchImmediate` + JS-side coalescing, NOT the plugin's debounced
 *    `watch`. With `delayMs` set, tauri-plugin-fs (2.5, notify-debouncer-full
 *    0.6) routes through a debouncer whose file-ID cache walks the entire tree
 *    at watcher creation on macOS and Windows (`RecommendedCache = FileIdMap`;
 *    Linux uses `NoCache`), inside a synchronous Tauri command — on large
 *    roots that froze the app at startup / folder add.
 *  - Fixed-window coalescing: the first qualifying event schedules a refresh
 *    `debounceMs` later and further events ride the same window, so sustained
 *    filesystem churn cannot starve refreshes.
 *  - Incremental registry: adding a folder creates only the new watcher.
 *  - A failed watcher registration is evicted so a later reconciliation can
 *    retry it (guarded against remove/re-add races via promise identity).
 *  - Tradeoff: raw (uncoalesced) events now cross IPC; the JS window bounds
 *    the refresh work, not the message volume.
 */
export function createFolderWatcherController(
  onChange: () => void,
  options: FolderWatcherControllerOptions = {},
): FolderWatcherController {
  const watch: FolderWatchFn = options.watch
    ?? ((path, onEvent) => watchImmediate(path, onEvent, { recursive: true }));
  const debounceMs = options.debounceMs ?? WATCH_DEBOUNCE_MS;
  const isRelevant = options.isRelevant ?? isDirectoryChangeEvent;
  const schedule: ScheduleFn = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel: CancelFn = options.cancel
    ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  // path → pending watcher registration; promise identity doubles as the
  // "is this watcher still current?" token for stale callbacks.
  const registry = new Map<string, Promise<UnwatchFn | null>>();
  let timer: unknown = null;
  let disposed = false;

  const fire = () => {
    if (timer !== null) return; // window already open — coalesce
    timer = schedule(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  const add = (path: string) => {
    // `pending` is referenced inside its own initialiser — safe because the
    // whole const binding completes synchronously before any event callback
    // or rejection can run in a later task.
    const pending: Promise<UnwatchFn | null> = watch(path, (event) => {
      if (disposed || registry.get(path) !== pending) return; // stale watcher
      if (isRelevant(event)) fire();
    }).catch((error: unknown) => {
      console.warn(`marka.md: failed to watch folder ${path}`, error);
      // evict so the next reconciliation can retry — unless the path was
      // removed or re-added (newer registration) in the meantime
      if (registry.get(path) === pending) registry.delete(path);
      return null;
    });
    registry.set(path, pending);
  };

  return {
    setPaths(paths) {
      if (disposed) return;
      const wanted = new Set(paths);
      for (const [path, pending] of registry) {
        if (wanted.has(path)) continue;
        registry.delete(path);
        void pending.then((unwatch) => unwatch?.());
      }
      for (const path of wanted) {
        if (!registry.has(path)) add(path);
      }
    },
    dispose() {
      disposed = true;
      for (const pending of registry.values()) {
        void pending.then((unwatch) => unwatch?.());
      }
      registry.clear();
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
    },
  };
}

/** Watches each opened root recursively and refreshes the visible tree on structure changes. */
export function useFolderWatcher(paths: readonly string[], onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  const controllerRef = useRef<FolderWatcherController | null>(null);
  const pathsKey = watchableFolderPaths(paths).join("\0");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // controller per mount (not per render) — StrictMode's setup/cleanup/setup
  // gets a fresh controller each time, so dispose() can be terminal.
  useEffect(() => {
    const controller = createFolderWatcherController(() => onChangeRef.current());
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.dispose();
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setPaths(pathsKey ? pathsKey.split("\0") : []);
  }, [pathsKey]);
}
