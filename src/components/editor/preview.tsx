import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import { renderMarkdown, useI18n, useTheme } from "@/lib";
import { extensionFromMarkdownAssetSrc, markdownMediaAssetForExtension } from "@/lib/media-assets";
import inspectUrl from "@/assets/mascot/inspect.png";
import { renderMermaidBlocks } from "@/lib/mermaid";
import { decoratePlantUmlBlocks } from "@/lib/plantuml";
import { basename, isCsvPath } from "@/lib";
import { CsvPreview } from "./csv-preview";
import {
  createDiagramViewer,
  decorateImages,
  decorateMermaidBlocks,
  DiagramViewerOverlay,
  type DiagramViewer,
  type DiagramViewerSource,
  type MermaidViewerLabels,
} from "./diagram-viewer";

type PreviewProps = {
  source: string;
  filePath?: string | null;
  onOpenPreviewWindow?: () => void;
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

function replaceImageWithMedia(img: HTMLImageElement, src: string, kind: "video" | "audio"): void {
  const media = document.createElement(kind);
  media.className = `mdv-media mdv-media--${kind}`;
  media.controls = true;
  media.preload = "metadata";
  media.src = src;

  const label = img.getAttribute("alt");
  if (label) media.setAttribute("aria-label", label);

  const title = img.getAttribute("title");
  if (title) media.title = title;

  if (kind === "video") {
    media.setAttribute("playsinline", "");
  }

  img.replaceWith(media);
}

function replaceRemoteMediaImages(article: HTMLElement): void {
  Array.from(article.querySelectorAll("img")).forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || !/^(?:https?:|data:|tauri:|asset:)/.test(src)) return;
    const asset = markdownMediaAssetForExtension(extensionFromMarkdownAssetSrc(src));
    if (asset.kind !== "image") replaceImageWithMedia(img, src, asset.kind);
  });
}

async function resolveMarkdownMediaAssets(article: HTMLElement, filePath: string): Promise<void> {
  const lastSep = Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/"));
  const dir = filePath.slice(0, lastSep);
  const sep = filePath.includes("\\") ? "\\" : "/";
  await Promise.all(
    Array.from(article.querySelectorAll("img")).map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || /^(?:https?:|data:|tauri:|asset:)/.test(src)) return;
      const decoded = decodeURIComponent(src.startsWith("./") ? src.slice(2) : src);
      const absPath = dir + sep + decoded.replace(/\//g, sep);
      const asset = markdownMediaAssetForExtension(extensionFromMarkdownAssetSrc(decoded));
      try {
        const bytes = await readFile(absPath);
        const dataUrl = `data:${asset.mime};base64,${uint8ToBase64(bytes)}`;
        if (asset.kind === "image") {
          img.src = dataUrl;
        } else {
          replaceImageWithMedia(img, dataUrl, asset.kind);
        }
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

export function Preview({ source, filePath, onOpenPreviewWindow }: PreviewProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [viewer, setViewer] = useState<DiagramViewer | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const csvPreview = filePath ? isCsvPath(filePath) : false;

  const viewerLabels = useMemo<MermaidViewerLabels>(() => ({
    open: t("diagram.openViewer"),
  }), [t]);

  const openDiagramViewer = useCallback((next: DiagramViewerSource) => {
    setViewer(createDiagramViewer(next));
  }, []);
  const closeDiagramViewer = useCallback(() => setViewer(null), []);
  const handleOpenPreviewWindow = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void onOpenPreviewWindow?.();
  }, [onOpenPreviewWindow]);

  const [html, setHtml] = useState("");
  const renderedHtml = useMemo(() => ({ __html: html }), [html]);

  // renderMarkdown lazy-loads shiki only when the document contains code.
  // Cancelled flag guards against stale renders on rapid file/theme switches.
  useEffect(() => {
    if (csvPreview) return;
    let cancelled = false;
    void renderMarkdown(source, theme).then((h) => {
      if (!cancelled) setHtml(h);
    });
    return () => {
      cancelled = true;
    };
  }, [source, theme, csvPreview]);

  // React owns the base markdown HTML; the effects below only decorate the
  // rendered DOM with media resolution, diagram viewers, and code copy buttons.
  useEffect(() => {
    if (!articleRef.current || csvPreview) return;
    replaceRemoteMediaImages(articleRef.current);
    if (filePath) void resolveMarkdownMediaAssets(articleRef.current, filePath);
  }, [html, filePath, csvPreview]);

  useEffect(() => {
    if (!articleRef.current || csvPreview) return;
    const cleanupCode = decorateCodeBlocks(articleRef.current);
    const cleanupPlantUml = decoratePlantUmlBlocks(articleRef.current, openDiagramViewer, viewerLabels);
    const cleanupImages = decorateImages(articleRef.current, openDiagramViewer);
    return () => {
      cleanupCode();
      cleanupPlantUml();
      cleanupImages();
    };
  }, [html, csvPreview, openDiagramViewer, viewerLabels]);

  useEffect(() => {
    if (!articleRef.current || csvPreview) return;
    const mermaidTheme = theme === "latte" || theme === "matcha" ? "default" : "dark";
    let cancelled = false;
    let cleanup = () => {};
    void renderMermaidBlocks(articleRef.current, mermaidTheme).then(() => {
      if (cancelled || !articleRef.current) return;
      cleanup = decorateMermaidBlocks(articleRef.current, openDiagramViewer, viewerLabels);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [html, theme, csvPreview, openDiagramViewer, viewerLabels]);

  useEffect(() => {
    const article = articleRef.current;
    const preview = previewRef.current;
    if (!article || !preview || csvPreview) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) {
        e.preventDefault();
        const id = decodeURIComponent(href.slice(1));
        const target = article.querySelector(`[id="${CSS.escape(id)}"]`) ?? article.querySelector(`[id="${id}"]`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (/^https?:\/\//.test(href)) {
        e.preventDefault();
        void openUrl(href);
      }
    };
    article.addEventListener("click", onClick);
    return () => article.removeEventListener("click", onClick);
  }, [html, csvPreview]);

  if (!csvPreview && source.trim().length === 0) {
    return (
      <div className="mdv-preview" data-theme={theme}>
        {onOpenPreviewWindow ? (
          <div className="mdv-preview__floating-actions">
            <Button
              className="mdv-preview__float-button"
              data-tooltip={t("title.openPreviewWindowTooltip")}
              aria-label={t("title.openPreviewWindow")}
              onClick={handleOpenPreviewWindow}
              icon={<Icon icon={ExternalLink} size={12} strokeWidth={1.7} />}
            />
          </div>
        ) : null}
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
        {onOpenPreviewWindow ? (
          <div className="mdv-preview__floating-actions">
            <Button
              className="mdv-preview__float-button"
              data-tooltip={t("title.openPreviewWindowTooltip")}
              aria-label={t("title.openPreviewWindow")}
              onClick={handleOpenPreviewWindow}
              icon={<Icon icon={ExternalLink} size={12} strokeWidth={1.7} />}
            />
          </div>
        ) : null}
        {csvPreview ? (
          <CsvPreview source={source} fileName={filePath ? basename(filePath) : undefined} />
        ) : (
          <article
            ref={articleRef}
            className="mdv-prose"
            data-theme={theme}
            dangerouslySetInnerHTML={renderedHtml}
          />
        )}
      </div>
      {viewer ? (
        <DiagramViewerOverlay
          viewer={viewer}
          onChange={setViewer}
          onClose={closeDiagramViewer}
        />
      ) : null}
    </>
  );
}
