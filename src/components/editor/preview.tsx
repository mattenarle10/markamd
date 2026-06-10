import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { ensureMarkdownReady, renderMarkdown, useI18n, useTheme } from "@/lib";
import inspectUrl from "@/assets/mascot/inspect.png";
import { renderMermaidBlocks } from "@/lib/mermaid";
import { basename, isCsvPath } from "@/lib";
import { CsvPreview } from "./csv-preview";
import {
  createDiagramViewer,
  decorateMermaidBlocks,
  DiagramViewerOverlay,
  type DiagramViewer,
  type DiagramViewerSource,
  type MermaidViewerLabels,
} from "./diagram-viewer";

type PreviewProps = {
  source: string;
  filePath?: string | null;
};

// hand-written lucide copy + check icons so we don't drag in react-dom/server
const COPY_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const COPY_DEFAULT_HTML = `<span class="mdv-copy__icon mdv-copy__icon--default">${COPY_ICON_SVG}copy</span>`;
const COPY_DONE_HTML = `<span class="mdv-copy__icon mdv-copy__icon--done">${CHECK_ICON_SVG}copied</span>`;

function uint8ToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const CHUNK = 8192;
  for (let i = 0; i < bytes.byteLength; i += CHUNK)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  return btoa(chunks.join(""));
}

function imgMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg": case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    case "bmp": return "image/bmp";
    default: return "image/png";
  }
}

async function resolveLocalImages(article: HTMLElement, filePath: string): Promise<void> {
  const lastSep = Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/"));
  const dir = filePath.slice(0, lastSep);
  const sep = filePath.includes("\\") ? "\\" : "/";
  await Promise.all(
    Array.from(article.querySelectorAll("img")).map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || /^(?:https?:|data:|tauri:|asset:)/.test(src)) return;
      const decoded = decodeURIComponent(src.startsWith("./") ? src.slice(2) : src);
      const absPath = dir + sep + decoded.replace(/\//g, sep);
      const dot = decoded.lastIndexOf(".");
      const ext = dot >= 0 ? decoded.slice(dot + 1) : "png";
      try {
        const bytes = await readFile(absPath);
        img.src = `data:${imgMime(ext)};base64,${uint8ToBase64(bytes)}`;
      } catch {
        // leave src as-is if file can't be read
      }
    })
  );
}

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

export function Preview({ source, filePath }: PreviewProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [viewer, setViewer] = useState<DiagramViewer | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const csvPreview = filePath ? isCsvPath(filePath) : false;

  const viewerLabels = useMemo<MermaidViewerLabels>(() => ({
    open: t("diagram.openViewer"),
  }), [t]);

  const openMermaidViewer = useCallback((next: DiagramViewerSource) => {
    setViewer(createDiagramViewer(next));
  }, []);
  const closeMermaidViewer = useCallback(() => setViewer(null), []);

  useEffect(() => {
    let cancelled = false;
    void ensureMarkdownReady().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [html, setHtml] = useState("");

  // renderMarkdown is async (lazy-loads shiki themes + langs on demand).
  // Cancelled flag guards against stale renders on rapid file/theme switches.
  useEffect(() => {
    if (!ready || csvPreview) return;
    let cancelled = false;
    void renderMarkdown(source, theme).then((h) => {
      if (!cancelled) setHtml(h);
    });
    return () => {
      cancelled = true;
    };
  }, [source, theme, ready, csvPreview]);

  // Imperatively set innerHTML — React's dangerouslySetInnerHTML re-applies the
  // string on each parent re-render even when the value is unchanged, which
  // wipes mermaid's post-render DOM mutations (and shiki's decorate-codeblock
  // wrappers). Setting innerHTML in a useEffect that only fires when `html`
  // actually changes preserves mermaid SVGs across save / saveStatus updates.
  useEffect(() => {
    if (!articleRef.current || csvPreview) return;
    articleRef.current.innerHTML = html;
    if (filePath) void resolveLocalImages(articleRef.current, filePath);
  }, [html, filePath, csvPreview]);

  useEffect(() => {
    if (!articleRef.current || csvPreview) return;
    return decorateCodeBlocks(articleRef.current);
  }, [html, csvPreview]);

  useEffect(() => {
    if (!articleRef.current || csvPreview) return;
    const mermaidTheme = theme === "latte" || theme === "matcha" ? "default" : "dark";
    let cancelled = false;
    let cleanup = () => {};
    void renderMermaidBlocks(articleRef.current, mermaidTheme).then(() => {
      if (cancelled || !articleRef.current) return;
      cleanup = decorateMermaidBlocks(articleRef.current, openMermaidViewer, viewerLabels);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [html, theme, csvPreview, openMermaidViewer, viewerLabels]);

  useEffect(() => {
    const article = articleRef.current;
    const preview = previewRef.current;
    if (!article || !preview || csvPreview) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href?.startsWith("#")) return;
      e.preventDefault();
      const id = decodeURIComponent(href.slice(1));
      const target = article.querySelector(`[id="${CSS.escape(id)}"]`) ?? article.querySelector(`[id="${id}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    article.addEventListener("click", onClick);
    return () => article.removeEventListener("click", onClick);
  }, [html, csvPreview]);

  if (!csvPreview && source.trim().length === 0) {
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
    <>
      <div ref={previewRef} className="mdv-preview" data-theme={theme}>
        {csvPreview ? (
          <CsvPreview source={source} fileName={filePath ? basename(filePath) : undefined} />
        ) : (
          <article
            ref={articleRef}
            className="mdv-prose"
            data-theme={theme}
          />
        )}
      </div>
      {viewer ? (
        <DiagramViewerOverlay
          viewer={viewer}
          onChange={setViewer}
          onClose={closeMermaidViewer}
        />
      ) : null}
    </>
  );
}
