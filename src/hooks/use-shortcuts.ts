import { useEffect } from "react";
import { matchesShortcut } from "@/lib/shortcuts";

export type ShortcutHandler = (event: KeyboardEvent) => void;

/**
 * Map keys like "mod+b", "mod+shift+o", or "escape" to handlers.
 * `mod` (or `cmd`) means Cmd on macOS and Ctrl elsewhere.
 * `ctrl` is literal Ctrl; `mod+ctrl` requires both keys only on macOS.
 * Extra modifiers are rejected, so Cmd+F and Ctrl+Cmd+F stay distinct.
 * Use FULLSCREEN_SHORTCUT.binding for the platform-specific fullscreen key.
 */
export function useShortcuts(map: Record<string, ShortcutHandler>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const [combo, handler] of Object.entries(map)) {
        if (!matchesShortcut(combo, e)) continue;
        handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map]);
}
