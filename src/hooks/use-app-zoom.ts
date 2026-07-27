import { useCallback, useEffect, useMemo } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { STORAGE_KEYS } from "@/lib/storage";
import { usePersistedState } from "./use-persisted-state";
import { useShortcuts } from "./use-shortcuts";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

/** Clamp/repair any persisted or computed value to a valid zoom level:
 *  finite number, one decimal, within 50%–300%. Anything else becomes 1. */
export function normalizeZoomLevel(value: unknown): number {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(num * 10) / 10));
}

/**
 * App-wide zoom (mod+= / mod+- / mod+0), applied at the webview level so the
 * whole UI scales together — complements the writing/reading font-size
 * settings, which keep controlling prose type independently.
 *
 * Used by both window roots (App and the detached PreviewWindow): each window
 * applies the persisted level when it mounts, and the shortcuts act on the
 * focused window. Persisted values are normalized before use so corrupted
 * localStorage can never drive setZoom outside the supported range.
 */
export function useAppZoom(): void {
  const [zoomLevel, setZoomLevel] = usePersistedState<number>(
    STORAGE_KEYS.zoomLevel,
    1,
  );

  useEffect(() => {
    const safe = normalizeZoomLevel(zoomLevel);
    if (safe !== zoomLevel) {
      // repair out-of-range / non-numeric persisted values before applying
      setZoomLevel(safe);
      return;
    }
    // native chrome (macOS traffic lights) keeps its physical size under page
    // zoom — expose the level so CSS can counter-scale fixed insets
    document.documentElement.style.setProperty("--mdv-zoom", String(safe));
    getCurrentWebview()
      .setZoom(safe)
      .catch((err) => console.error("marka.md: setZoom failed", err));
  }, [zoomLevel, setZoomLevel]);

  const zoomBy = useCallback(
    (delta: number) => {
      setZoomLevel((current) => normalizeZoomLevel(normalizeZoomLevel(current) + delta));
    },
    [setZoomLevel],
  );

  useShortcuts(
    useMemo(
      () => ({
        "mod+=": (e: KeyboardEvent) => {
          e.preventDefault();
          zoomBy(ZOOM_STEP);
        },
        "mod+shift+=": (e: KeyboardEvent) => {
          // ⌘⇧= is ⌘+ on most layouts — treat it as zoom in too
          e.preventDefault();
          zoomBy(ZOOM_STEP);
        },
        "mod+-": (e: KeyboardEvent) => {
          e.preventDefault();
          zoomBy(-ZOOM_STEP);
        },
        "mod+0": (e: KeyboardEvent) => {
          e.preventDefault();
          setZoomLevel(1);
        },
      }),
      [zoomBy, setZoomLevel],
    ),
  );
}
