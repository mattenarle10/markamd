import { useEffect, useRef } from "react";
import { watchImmediate, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";

const WATCH_DEBOUNCE_MS = 350;

export function isFileContentChangeEvent(event: WatchEvent): boolean {
  if (event.type === "any") return true;
  if (typeof event.type === "string") return false;
  if ("create" in event.type || "remove" in event.type) return true;
  if ("modify" in event.type) {
    return event.type.modify.kind === "any" || event.type.modify.kind === "data";
  }
  return false;
}

type FileWatchFn = (
  path: string,
  onEvent: (event: WatchEvent) => void,
) => Promise<UnwatchFn>;

type ScheduleFn = (fn: () => void, ms: number) => unknown;
type CancelFn = (id: unknown) => void;

export type FileWatcherController = {
  setPath(path: string | null): void;
  dispose(): void;
};

export type FileWatcherControllerOptions = {
  watch?: FileWatchFn;
  debounceMs?: number;
  isRelevant?: (event: WatchEvent) => boolean;
  schedule?: ScheduleFn;
  cancel?: CancelFn;
};

export function createFileWatcherController(
  onChange: () => void,
  options: FileWatcherControllerOptions = {},
): FileWatcherController {
  const watch: FileWatchFn = options.watch ?? ((path, onEvent) => watchImmediate(path, onEvent));
  const debounceMs = options.debounceMs ?? WATCH_DEBOUNCE_MS;
  const isRelevant = options.isRelevant ?? isFileContentChangeEvent;
  const schedule: ScheduleFn = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel: CancelFn = options.cancel
    ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let watchedPath: string | null = null;
  let pending: Promise<UnwatchFn | null> | null = null;
  let timer: unknown = null;
  let disposed = false;

  const cancelPendingChange = () => {
    if (timer === null) return;
    cancel(timer);
    timer = null;
  };

  const fire = () => {
    if (timer !== null) return;
    timer = schedule(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  const clearWatcher = () => {
    const current = pending;
    watchedPath = null;
    pending = null;
    cancelPendingChange();
    void current?.then((unwatch) => unwatch?.());
  };

  const addWatcher = (path: string) => {
    // `registration` is referenced inside its own initializer; the callback
    // can only run after this synchronous assignment completes.
    const registration: Promise<UnwatchFn | null> = watch(path, (event) => {
      if (disposed || pending !== registration) return;
      if (isRelevant(event)) fire();
    }).catch((error: unknown) => {
      console.warn(`marka.md: failed to watch file ${path}`, error);
      if (pending === registration) {
        watchedPath = null;
        pending = null;
      }
      return null;
    });
    watchedPath = path;
    pending = registration;
  };

  return {
    setPath(path) {
      if (disposed || path === watchedPath) return;
      clearWatcher();
      if (path) addWatcher(path);
    },
    dispose() {
      disposed = true;
      clearWatcher();
    },
  };
}

/**
 * Watches the active file through Tauri's native filesystem watcher.
 */
export function useFileWatcher(path: string | null, onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  const controllerRef = useRef<FileWatcherController | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const controller = createFileWatcherController(() => onChangeRef.current());
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.dispose();
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setPath(path);
  }, [path]);
}
