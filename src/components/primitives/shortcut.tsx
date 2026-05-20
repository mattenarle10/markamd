import { Fragment } from "react";
import { displayKey } from "@/lib";
import { Kbd } from "./kbd";

type ShortcutProps = {
  /**
   * Mac-glyph format separated by `+`. Examples:
   *   "⌘+S"        → mac: ⌘ S        | win: Ctrl S
   *   "⌘+⇧+O"      → mac: ⌘ ⇧ O      | win: Ctrl Shift O
   *   "⌘+⌥+Z"      → mac: ⌘ ⌥ Z      | win: Ctrl Alt Z
   */
  keys: string;
  /** rendered between key chips. Defaults to nothing (chips sit flush, css gap). */
  separator?: string;
};

/**
 * Platform-aware shortcut display. Converts mac glyphs to Ctrl/Alt/Shift
 * when running on Windows/Linux. Render-only — does NOT bind anything.
 */
export function Shortcut({ keys, separator }: ShortcutProps) {
  const segments = keys.split("+").map((s) => s.trim()).filter(Boolean);
  return (
    <>
      {segments.map((seg, i) => (
        <Fragment key={`${seg}-${i}`}>
          {i > 0 && separator ? <span aria-hidden>{separator}</span> : null}
          <Kbd>{displayKey(seg)}</Kbd>
        </Fragment>
      ))}
    </>
  );
}
