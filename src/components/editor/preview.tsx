import { useEffect, useMemo, useRef, useState } from "react";
import { ensureMarkdownReady, renderMarkdown, useTheme } from "@/lib";
import inspectUrl from "@/assets/mascot/inspect.png";

let mermaidLib: typeof import("mermaid")["default"] | null = null;
let mermaidLoading: Promise<typeof import("mermaid")["default"]> | null = null;
let mermaidInitializedTheme: "default" | "dark" | null = null;

async function getMermaid(themeName: "default" | "dark") {
  if (mermaidLib) return mermaidLib;
  if (!mermaidLoading) {
    mermaidLoading = import("mermaid").then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: themeName,
        securityLevel: "strict",
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
      });
      mermaidInitializedTheme = themeName;
      mermaidLib = mod.default;
      return mod.default;
    });
  }
  return mermaidLoading;
}

async function renderMermaidBlocks(root: HTMLElement, theme: "default" | "dark") {
  const blocks = Array.from(root.querySelectorAll<HTMLPreElement>("pre.mdv-mermaid:not(.is-rendered)"));
  if (blocks.length === 0) return;
  const mermaid = await getMermaid(theme);
  // only re-initialize when theme actually changed; avoids id-registry churn + flicker
  if (mermaidInitializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: "strict",
      fontFamily: "JetBrains Mono, ui-monospace, monospace",
    });
    mermaidInitializedTheme = theme;
  }

  for (const pre of blocks) {
    const code = pre.querySelector("code")?.textContent ?? "";
    const id = pre.id || `mdv-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const { svg } = await mermaid.render(`${id}-svg`, code);
      pre.innerHTML = svg;
      pre.classList.add("is-rendered");
    } catch (err) {
      console.error("marka.md: mermaid render failed", err);
      // safe fallback — build with textContent, never innerHTML on user input
      pre.replaceChildren();
      const codeEl = document.createElement("code");
      codeEl.className = "mdv-mermaid__error";
      codeEl.textContent = code;
      pre.appendChild(codeEl);
      pre.classList.add("is-rendered", "is-error");
    }
  }
}

type PreviewProps = {
  source: string;
};

// hand-written lucide copy + check icons so we don't drag in react-dom/server
const COPY_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const COPY_DEFAULT_HTML = `<span class="mdv-copy__icon mdv-copy__icon--default">${COPY_ICON_SVG}copy</span>`;
const COPY_DONE_HTML = `<span class="mdv-copy__icon mdv-copy__icon--done">${CHECK_ICON_SVG}copied</span>`;

function decorateCodeBlocks(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  const blocks = Array.from(root.querySelectorAll("pre.shiki")) as HTMLPreElement[];

  blocks.forEach((pre) => {
    if (pre.parentElement?.classList.contains("mdv-codeblock")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "mdv-codeblock";
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mdv-copy";
    btn.setAttribute("aria-label", "copy code");
    btn.innerHTML = `${COPY_DEFAULT_HTML}${COPY_DONE_HTML}`;
    wrapper.appendChild(btn);

    const onClick = async (e: MouseEvent) => {
      e.preventDefault();
      const text = pre.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          // give up
        }
        document.body.removeChild(ta);
      }
      btn.classList.add("is-done");
      window.setTimeout(() => btn.classList.remove("is-done"), 1400);
    };

    btn.addEventListener("click", onClick);
    cleanups.push(() => btn.removeEventListener("click", onClick));
  });

  return () => cleanups.forEach((fn) => fn());
}

export function Preview({ source }: PreviewProps) {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureMarkdownReady().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const html = useMemo(() => renderMarkdown(source, theme), [source, theme, ready]);

  // Imperatively set innerHTML — React's dangerouslySetInnerHTML re-applies the
  // string on each parent re-render even when the value is unchanged, which
  // wipes mermaid's post-render DOM mutations (and shiki's decorate-codeblock
  // wrappers). Setting innerHTML in a useEffect that only fires when `html`
  // actually changes preserves mermaid SVGs across save / saveStatus updates.
  useEffect(() => {
    if (!articleRef.current) return;
    articleRef.current.innerHTML = html;
  }, [html]);

  useEffect(() => {
    if (!articleRef.current) return;
    return decorateCodeBlocks(articleRef.current);
  }, [html]);

  useEffect(() => {
    if (!articleRef.current) return;
    const mermaidTheme = theme === "latte" || theme === "matcha" ? "default" : "dark";
    void renderMermaidBlocks(articleRef.current, mermaidTheme);
  }, [html, theme]);

  if (source.trim().length === 0) {
    return (
      <div className="mdv-preview" data-theme={theme}>
        <div className="mdv-preview__empty">
          <img
            src={inspectUrl}
            alt=""
            aria-hidden
            width={120}
            height={120}
            draggable={false}
            className="mdv-preview__empty-art"
          />
          <span className="mdv-preview__empty-title">nothing to preview</span>
          <span className="mdv-preview__empty-hint">start typing on the left</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mdv-preview" data-theme={theme}>
      <article
        ref={articleRef}
        className="mdv-prose"
        data-theme={theme}
      />
    </div>
  );
}
