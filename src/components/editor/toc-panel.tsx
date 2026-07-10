import { useEffect, useState } from "react";
import { useI18n } from "@/lib";

type TocItem = {
  el: HTMLElement;
  id: string;
  text: string;
  level: number;
};

type Props = {
  /** when true the panel is rendered */
  open: boolean;
  /** the rendered `<article class="mdv-prose">` to read headings from */
  scope: HTMLElement | null;
  /** changes whenever `scope`'s innerHTML changes (re-walks fresh DOM) */
  contentKey?: string | number;
};

function extractToc(scope: HTMLElement): TocItem[] {
  return Array.from(
    scope.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
  )
    .map((el) => ({
      el,
      id: el.id,
      text: el.textContent?.trim() ?? "",
      level: Number(el.tagName.slice(1)),
    }))
    .filter((item) => item.text.length > 0);
}

/**
 * Docked outline panel for reading mode. Reads the rendered headings from the
 * prose article — each heading already carries a GitHub-style slug `id` from
 * the markdown renderer (markdown.ts heading_open rule) — and scrolls to the
 * chosen heading on click. Mirrors ReadingFind's (open, scope, contentKey)
 * contract so it re-walks fresh DOM after a Preview re-render.
 */
export function TocPanel({ open, scope, contentKey }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    if (!open || !scope) {
      setItems([]);
      return;
    }
    // wait a frame so a freshly-rendered article is committed to the DOM
    const raf = window.requestAnimationFrame(() => {
      if (!scope.isConnected) return;
      setItems(extractToc(scope));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, scope, contentKey]);

  if (!open || !scope) return null;

  const minLevel = items.length ? Math.min(...items.map((i) => i.level)) : 1;

  return (
    <nav className="mdv-toc" aria-label={t("title.toc")}>
      <div className="mdv-toc__header">{t("title.toc")}</div>
      <ul className="mdv-toc__list">
        {items.map((item, idx) => (
          <li
            key={`${item.id || "h"}-${idx}`}
            className={`mdv-toc__item mdv-toc__item--${item.level}`}
          >
            <button
              type="button"
              className="mdv-toc__link"
              style={{ paddingLeft: 8 + (item.level - minLevel) * 12 }}
              title={item.text}
              onClick={() =>
                item.el.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <span className="mdv-toc__empty">{t("toc.empty")}</span>
      ) : null}
    </nav>
  );
}
