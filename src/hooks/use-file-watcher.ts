import { useEffect } from "react";
import { stat } from "@tauri-apps/plugin-fs";

/**
 * Polls mtime every 2s. Pauses on blur, resumes on focus.
 * Picked over tauri-plugin-fs-watch: md files are cheap, no new rust deps.
 */
export function useFileWatcher(path: string | null, onChange: () => void): void {
  useEffect(() => {
    if (!path) return;
    let lastMtime: number | null = null;
    let active = true;
    let intervalId: number | null = null;

    const check = async () => {
      if (!active) return;
      try {
        const meta = await stat(path);
        const m = meta.mtime ? new Date(meta.mtime).getTime() : null;
        // first read seeds lastMtime without firing onChange — only later ticks
        // count as "external changes".
        if (lastMtime !== null && m !== null && m !== lastMtime) {
          onChange();
        }
        lastMtime = m;
      } catch {
        // file deleted / unreadable — stop polling cleanly, no error spam
        active = false;
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    const startInterval = () => {
      if (intervalId === null) {
        intervalId = window.setInterval(check, 2000);
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
    const onBlur = () => {
      stopInterval();
    };

    void check(); // seed lastMtime
    startInterval();
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    return () => {
      active = false;
      stopInterval();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [path, onChange]);
}
