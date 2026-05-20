import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [role='menuitem'], [role='menuitemradio'], [role='menuitemcheckbox'], [contenteditable='true'], .mdv-titlebar__theme, .mdv-tooltip";

// Belt-and-suspenders drag handler. data-tauri-drag-region works on most
// macOS versions, but the "Overlay" title-bar style has documented caveats
// around custom drag regions (Tauri 2 docs). This calls startDragging()
// directly so window movement is guaranteed regardless of webkit quirks.
export function startWindowDrag(e: ReactMouseEvent<HTMLElement>): void {
  // Only primary (left) button
  if (e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest(INTERACTIVE_SELECTOR)) return;
  // Fire-and-forget — don't await, mousedown shouldn't be async-blocked.
  void getCurrentWindow()
    .startDragging()
    .catch((err) => {
      console.warn("marka.md: startDragging failed", err);
    });
}
