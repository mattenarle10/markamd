export const TEXT_DIRECTION_OPTIONS = ["auto", "ltr", "rtl"] as const;
export type TextDirection = (typeof TEXT_DIRECTION_OPTIONS)[number];

export const DEFAULT_TEXT_DIRECTION: TextDirection = "auto";

export function normalizeTextDirection(value: unknown): TextDirection {
  return typeof value === "string" && TEXT_DIRECTION_OPTIONS.includes(value as TextDirection)
    ? (value as TextDirection)
    : DEFAULT_TEXT_DIRECTION;
}

const TECHNICAL_SELECTOR = "code, kbd, samp, pre, .mdv-codeblock, .mdv-mermaid, .mdv-plantuml";
// Conservative RTL script ranges, including supplementary planes and the RTL mark.
const RTL_TEXT = /[\u0590-\u08ff\u200f\ufb1d-\ufdff\ufe70-\ufeff\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]/u;

/**
 * Applies native Unicode BiDi behavior to rendered markdown without changing
 * the source. In auto mode, blocks that can differ from their inherited
 * direction keep native per-block detection.
 */
export function applyTextDirection(article: HTMLElement, direction: TextDirection): void {
  article.setAttribute("dir", direction);
  const canInheritLtr = direction === "auto"
    && article.ownerDocument.defaultView?.getComputedStyle(article).direction === "ltr";

  for (const child of Array.from(article.children)) {
    // Avoid invalidating bidi layout for every block in large LTR documents.
    // Detached export articles have no computed direction, so keep their attrs.
    if (canInheritLtr && !RTL_TEXT.test(child.textContent ?? "")) {
      child.removeAttribute("dir");
    } else {
      child.setAttribute("dir", direction);
    }
  }

  for (const node of Array.from(article.querySelectorAll(TECHNICAL_SELECTOR))) {
    node.setAttribute("dir", "ltr");
  }
}
