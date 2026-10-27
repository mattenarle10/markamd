import { IS_MAC } from "./platform";

export function getFullscreenShortcut(isMac = IS_MAC) {
  return isMac
    ? { binding: "mod+ctrl+f", label: "⌃⌘F", keys: "⌃+⌘+F" }
    : { binding: "f11", label: "F11", keys: "F11" };
}

export const FULLSCREEN_SHORTCUT = getFullscreenShortcut();

// Match shifted symbols by physical key as well (Shift+. reports key=">"),
// and accept numeric-keypad codes for browser-style zoom.
const SHIFTED_KEY_CODES: Record<string, readonly string[]> = {
  ".": ["Period"],
  ",": ["Comma"],
  "/": ["Slash"],
  ";": ["Semicolon"],
  "'": ["Quote"],
  "[": ["BracketLeft"],
  "]": ["BracketRight"],
  "\\": ["Backslash"],
  "`": ["Backquote"],
  "-": ["Minus", "NumpadSubtract"],
  "=": ["Equal", "NumpadAdd"],
};

type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;

/** `mod` means Cmd on macOS and Ctrl elsewhere; other modifiers match exactly. */
export function matchesShortcut(
  combo: string,
  event: ShortcutEvent,
  isMac = IS_MAC,
): boolean {
  const parts = combo.toLowerCase().split("+").map((s) => s.trim());
  const hasMod = parts.includes("mod") || parts.includes("cmd");
  const hasCtrl = parts.includes("ctrl");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt") || parts.includes("option");
  const wantKey = parts[parts.length - 1];
  const wantCodes = SHIFTED_KEY_CODES[wantKey];

  if (event.key.toLowerCase() !== wantKey && !(wantCodes && wantCodes.includes(event.code))) {
    return false;
  }

  if (hasMod && hasCtrl) {
    if (isMac) {
      if (!(event.metaKey && event.ctrlKey)) return false;
    } else {
      // Outside macOS, `mod` is Ctrl, so `mod+ctrl` collapses to Ctrl.
      if (!event.ctrlKey) return false;
    }
  } else if (hasMod) {
    if (isMac) {
      if (!event.metaKey || event.ctrlKey) return false;
    } else {
      if (!event.ctrlKey || event.metaKey) return false;
    }
  } else if (hasCtrl) {
    if (!event.ctrlKey || event.metaKey) return false;
  } else {
    if (event.metaKey || event.ctrlKey) return false;
  }

  return needsShift === event.shiftKey && needsAlt === event.altKey;
}
