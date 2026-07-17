import { useEffect, useRef } from "react";
import { watch, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";

const WATCH_DEBOUNCE_MS = 350;

export function isDirectoryChangeEvent(event: WatchEvent): boolean {
  if (event.type === "any") return true;
  if (typeof event.type === "string") return false;
  if ("create" in event.type || "remove" in event.type) return true;
  if ("modify" in event.type) {
    return event.type.modify.kind === "any" || event.type.modify.kind === "rename";
  }
  return false;
}

/** Watches each opened root recursively and refreshes the visible tree on structure changes. */
export function useFolderWatcher(paths: readonly string[], onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  const pathsKey = paths.join("\0");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let disposed = false;
    const unwatchers = new Set<UnwatchFn>();
    const uniquePaths = Array.from(new Set(paths.filter(Boolean)));

    const start = async () => {
      for (const path of uniquePaths) {
        try {
          const unwatch = await watch(
            path,
            (event) => {
              if (isDirectoryChangeEvent(event)) onChangeRef.current();
            },
            { recursive: true, delayMs: WATCH_DEBOUNCE_MS },
          );
          if (disposed) {
            unwatch();
          } else {
            unwatchers.add(unwatch);
          }
        } catch (error) {
          console.warn(`marka.md: failed to watch folder ${path}`, error);
        }
      }
    };

    void start();
    return () => {
      disposed = true;
      for (const unwatch of unwatchers) unwatch();
      unwatchers.clear();
    };
  }, [pathsKey]);
}
