import { useEffect, type RefObject } from "react";
import { EditorView } from "@codemirror/view";

// markdown-it's typographer turns straight quotes into curly ones in the
// preview; normalize both sides before matching. Every replacement is 1:1 in
// length so computed indices remain valid on the original strings.
function normalizeTypography(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, " ");
}

/**
 * Text-selection sync from preview to editor.
 *
 * Keep this one-way: mirroring editor selections into the browser's native
 * preview selection can steal replacement typing from CodeMirror.
 */
export function useSelectionSyncText(
  viewRef: RefObject<EditorView | null>,
  rebindKey?: unknown,
): void {
  useEffect(() => {
    // Remember the last selection we acted on. mouseup fires for ANY mouse
    // release — including scrollbar drags and stray clicks — while a previous
    // selection still lingers. Without this guard, scrolling via the scrollbar
    // re-runs the sync and its scrollIntoView snaps both panes back to the old
    // selection. We only act when the selection actually changed.
    let last: {
      anchorNode: Node | null;
      anchorOffset: number;
      focusNode: Node | null;
      focusOffset: number;
    } | null = null;

    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        last = null;
        return;
      }
      const text = sel.toString();
      if (!text.trim()) {
        last = null;
        return;
      }

      // same selection as last time → stray mouseup (e.g. scrollbar drag), skip
      if (
        last &&
        last.anchorNode === sel.anchorNode &&
        last.anchorOffset === sel.anchorOffset &&
        last.focusNode === sel.focusNode &&
        last.focusOffset === sel.focusOffset
      ) {
        return;
      }
      last = {
        anchorNode: sel.anchorNode,
        anchorOffset: sel.anchorOffset,
        focusNode: sel.focusNode,
        focusOffset: sel.focusOffset,
      };

      const prose = document.querySelector<HTMLElement>(".mdv-prose");
      const anchor = sel.anchorNode;

      if (prose && anchor && prose.contains(anchor)) {
        // Preview → Editor: the anchor's enclosing block carries its exact
        // source line range (data-sline/data-eline stamped at render time),
        // so we search only within those source lines.
        const view = viewRef.current;
        if (!view) return;
        const doc = view.state.doc;
        const anchorEl = anchor instanceof Element ? anchor : anchor.parentElement;
        const block = anchorEl?.closest<HTMLElement>("[data-sline]");
        const needle = normalizeTypography(text);
        let bestIdx = -1;
        if (block) {
          const s = Number(block.dataset.sline);
          const e = Math.min(Number(block.dataset.eline ?? s + 1), doc.lines);
          if (Number.isFinite(s) && s + 1 <= doc.lines) {
            const from = doc.line(s + 1).from; // data-sline is 0-based
            const to = doc.line(Math.max(e, s + 1)).to;
            const idx = normalizeTypography(doc.sliceString(from, to)).indexOf(needle);
            if (idx >= 0) bestIdx = from + idx;
          }
        }
        if (bestIdx < 0) {
          // fallback: plain search across the whole source
          bestIdx = normalizeTypography(doc.toString()).indexOf(needle);
        }
        if (bestIdx < 0) return;
        view.dispatch({
          selection: { anchor: bestIdx, head: bestIdx + text.length },
          effects: EditorView.scrollIntoView(bestIdx, { y: "center" }),
        });
        return;
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [viewRef, rebindKey]);
}
