import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  /** when true, the find bar is mounted + visible */
  open: boolean;
  /** increments when the parent wants the existing input focused again */
  focusRequest?: number;
  /** parent calls this to close (Esc, × button, or external trigger) */
  onClose: () => void;
  /** the rendered `<article class="mdv-prose">` to search through */
  scope: HTMLElement | null;
  /**
   * any value that changes whenever `scope`'s innerHTML changes (e.g. the
   * source markdown). When this changes, the find component re-walks fresh
   * DOM so stale `<mark>` references don't linger after a Preview re-render.
   */
  contentKey?: string | number;
};

/**
 * Floating find bar for reading mode. ⌘F (handled by parent via useShortcuts)
 * toggles `open`; this component walks text nodes inside `scope`, wraps matches
 * in `<mark class="mdv-find-hit">`, and lets the user step through them.
 *
 * Cleanup is guaranteed on unmount + close: marks are unwrapped back to plain
 * text so the next render of the prose stays clean.
 */
export function ReadingFind({ open, focusRequest = 0, onClose, scope, contentKey }: Props) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<HTMLElement[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // re-highlight whenever query, scope, or content changes — debounced 80ms.
  // contentKey is in the deps so when Preview re-renders the prose article
  // (e.g. source markdown updated), we re-walk the fresh DOM instead of
  // operating on detached `<mark>` nodes from the previous walk.
  useEffect(() => {
    if (!open || !scope) return;
    const t = window.setTimeout(() => {
      clearHighlights(scope);
      const trimmed = query.trim();
      if (!trimmed) {
        setMatches([]);
        setActiveIdx(0);
        return;
      }
      const hits = findAndHighlight(scope, trimmed);
      // guard against the rare case where the article was replaced between
      // walk and state-write — drop disconnected nodes.
      const connected = hits.filter((h) => h.isConnected);
      setMatches(connected);
      setActiveIdx(0);
      if (connected[0]) {
        connected[0].classList.add("mdv-find-hit--active");
        connected[0].scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, query, scope, contentKey]);

  // cleanup on unmount or scope swap (e.g. reading mode toggled off)
  useEffect(() => {
    return () => {
      if (scope) clearHighlights(scope);
    };
  }, [scope]);

  // when the bar opens or ⌘F/Ctrl+F is pressed again, focus the input + select
  // any existing query for fast retype.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open, focusRequest]);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (matches.length === 0) return;
      matches[activeIdx]?.classList.remove("mdv-find-hit--active");
      const next = (activeIdx + dir + matches.length) % matches.length;
      setActiveIdx(next);
      const el = matches[next];
      if (el) {
        el.classList.add("mdv-find-hit--active");
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    },
    [matches, activeIdx],
  );

  if (!open) return null;

  const noMatch = query.trim().length > 0 && matches.length === 0;
  const countLabel = noMatch
    ? "no match"
    : matches.length === 0
      ? ""
      : `${activeIdx + 1} / ${matches.length}`;

  return (
    <div className="mdv-find" role="search">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            go(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            go(-1);
          }
        }}
        placeholder="find in page"
        aria-label="find in reading mode"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
      <span className="mdv-find__count" aria-live="polite">
        {countLabel}
      </span>
      <button
        type="button"
        className="mdv-find__btn"
        onClick={() => go(-1)}
        aria-label="previous match"
        disabled={matches.length === 0}
        title="previous match (Shift+Enter)"
      >
        ↑
      </button>
      <button
        type="button"
        className="mdv-find__btn"
        onClick={() => go(1)}
        aria-label="next match"
        disabled={matches.length === 0}
        title="next match (Enter)"
      >
        ↓
      </button>
      <button
        type="button"
        className="mdv-find__btn mdv-find__btn--close"
        onClick={onClose}
        aria-label="close find"
        title="close (Esc)"
      >
        ×
      </button>
    </div>
  );
}

// ── pure DOM helpers (no React state) ──

function findAndHighlight(scope: HTMLElement, query: string): HTMLElement[] {
  const needle = query.toLowerCase();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = (node as Text).parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      // skip our own UI + rendered SVG (mermaid) + code-copy chrome
      if (p.closest(".mdv-find, .mdv-mermaid svg, .mdv-copy")) {
        return NodeFilter.FILTER_REJECT;
      }
      // empty/whitespace-only nodes have nothing to match
      const txt = node.nodeValue ?? "";
      if (!txt || !txt.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const candidates: Text[] = [];
  while (walker.nextNode()) candidates.push(walker.currentNode as Text);

  const marks: HTMLElement[] = [];
  for (const textNode of candidates) {
    let remaining: Text = textNode;
    let idx = (remaining.nodeValue ?? "").toLowerCase().indexOf(needle);
    while (idx !== -1) {
      // splitText(idx) leaves `remaining` with chars BEFORE the match,
      // and returns a new node starting AT the match.
      const matchNode = remaining.splitText(idx);
      // splitText(needle.length) leaves matchNode with exactly the match,
      // and returns the rest.
      const after = matchNode.splitText(needle.length);

      const mark = document.createElement("mark");
      mark.className = "mdv-find-hit";
      mark.textContent = matchNode.nodeValue;
      matchNode.parentNode?.replaceChild(mark, matchNode);
      marks.push(mark);

      remaining = after;
      idx = (after.nodeValue ?? "").toLowerCase().indexOf(needle);
    }
  }
  return marks;
}

function clearHighlights(scope: HTMLElement): void {
  const marks = scope.querySelectorAll<HTMLElement>(".mdv-find-hit");
  marks.forEach((mark) => {
    const text = document.createTextNode(mark.textContent ?? "");
    mark.parentNode?.replaceChild(text, mark);
  });
  if (marks.length > 0) {
    // re-merge adjacent text nodes so future walks see clean text
    scope.normalize();
  }
}
