import { useEffect } from "react";
import { watch, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";

export function isFileContentChangeEvent(event: WatchEvent): boolean {
  if (event.type === "any") return true;
  if (typeof event.type === "string") return false;
  if ("create" in event.type || "remove" in event.type) return true;
  if ("modify" in event.type) {
    return event.type.modify.kind === "any" || event.type.modify.kind === "data";
  }
  return false;
}

/**
 * Watches the active file through Tauri's native filesystem watcher.
 */
export function useFileWatcher(path: string | null, onChange: () => void): void {
  useEffect(() => {
    if (!path) return;
    let disposed = false;
    let unwatch: UnwatchFn | null = null;

    void watch(
      path,
      (event) => {
        if (isFileContentChangeEvent(event)) onChange();
      },
      { delayMs: 350 },
    )
      .then((stop) => {
        if (disposed) stop();
        else unwatch = stop;
      })
      .catch((error) => {
        console.warn(`marka.md: failed to watch file ${path}`, error);
      });

    return () => {
      disposed = true;
      unwatch?.();
      unwatch = null;
    };
  }, [path, onChange]);
}
