// Platform detection. Computed once at module load — userAgent doesn't change.
const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

export const IS_MAC = /Mac|iPhone|iPad|iPod/i.test(ua);
export const IS_WINDOWS = /Windows/i.test(ua);
export const IS_LINUX = /Linux/i.test(ua) && !/Android/i.test(ua);

// Translate a mac-style shortcut key glyph to the current platform's label.
// macOS: ⌘ ⌥ ⇧ ⌃ stay as glyphs.
// Windows / Linux: ⌘ → Ctrl, ⌥ → Alt, ⇧ → Shift, ⌃ → Ctrl (rare).
export function displayKey(macGlyph: string): string {
  if (IS_MAC) return macGlyph;
  switch (macGlyph) {
    case "⌘":
      return "Ctrl";
    case "⌥":
      return "Alt";
    case "⇧":
      return "Shift";
    case "⌃":
      return "Ctrl";
    default:
      return macGlyph;
  }
}

// Translate a whole mac-style label (used in tooltip attribute strings) to the
// current platform's idiomatic form. Examples:
//   "reading mode (⌘.)"           mac → "reading mode (⌘.)"
//                                 win → "reading mode (Ctrl+.)"
//   "copy markdown (⌘⇧C)"         mac → "copy markdown (⌘⇧C)"
//                                 win → "copy markdown (Ctrl+Shift+C)"
//   "fullscreen (⌃⌘F)"           mac → "fullscreen (⌃⌘F)"
//                                 win → "fullscreen (Ctrl+F)" (no extra Ctrl)
// Use this for any string passed to `data-tooltip` or button `aria-label`.
export function shortcutLabel(label: string): string {
  if (IS_MAC) return label;
  return label
    .replace(/⌘\s*⇧\s*/g, "Ctrl+Shift+")
    .replace(/⌘\s*⌥\s*/g, "Ctrl+Alt+")
    .replace(/⌃\s*⌘\s*/g, "Ctrl+")
    .replace(/⌘\s*/g, "Ctrl+")
    .replace(/⌥\s*/g, "Alt+")
    .replace(/⇧\s*/g, "Shift+")
    .replace(/⌃\s*/g, "Ctrl+");
}
