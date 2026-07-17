import { useEffect, useRef } from "react";
import { directoryFingerprint, listFolder, type FileEntry } from "@/lib";

const DIRECTORY_POLL_MS = 2000;

/** Polls visible folder nodes so external additions and deletions reach the tree. */
export function useDirectoryWatcher(
  path: string,
  onChange: (entries: FileEntry[]) => void,
): void {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;
    let lastFingerprint: string | null = null;
    let intervalId: number | null = null;

    const check = async () => {
      if (!active) return;
      try {
        const entries = await listFolder(path);
        if (!active) return;
        const nextFingerprint = directoryFingerprint(entries);
        if (lastFingerprint !== null && nextFingerprint !== lastFingerprint) {
          onChangeRef.current(entries);
        }
        lastFingerprint = nextFingerprint;
      } catch {
        // The folder may be temporarily unavailable; retry on the next tick.
      }
    };

    const startInterval = () => {
      if (intervalId === null) {
        intervalId = window.setInterval(check, DIRECTORY_POLL_MS);
      }
    };
    const stopInterval = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onFocus = () => {
      startInterval();
      void check();
    };
    const onBlur = stopInterval;

    void check();
    startInterval();
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    return () => {
      active = false;
      stopInterval();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [path]);
}
