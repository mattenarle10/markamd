export const TEXT_DIRECTION_OPTIONS = ["auto", "ltr", "rtl"] as const;
export type TextDirection = (typeof TEXT_DIRECTION_OPTIONS)[number];

export const DEFAULT_TEXT_DIRECTION: TextDirection = "auto";

export function normalizeTextDirection(value: unknown): TextDirection {
  return typeof value === "string" && TEXT_DIRECTION_OPTIONS.includes(value as TextDirection)
    ? (value as TextDirection)
    : DEFAULT_TEXT_DIRECTION;
}

const TECHNICAL_SELECTOR = "code, kbd, samp, pre, .mdv-codeblock, .mdv-mermaid, .mdv-plantuml";

/**
 * Applies native Unicode BiDi behavior to rendered markdown without changing
 * the source. Each prose block gets its own direction in auto mode so a
 * document can mix RTL and LTR paragraphs naturally.
 */
export function applyTextDirection(article: HTMLElement, direction: TextDirection): void {
  article.setAttribute("dir", direction);

  for (const child of Array.from(article.children)) {
    child.setAttribute("dir", direction);
  }

  for (const node of Array.from(article.querySelectorAll(TECHNICAL_SELECTOR))) {
    node.setAttribute("dir", "ltr");
  }
}
