import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { readFile, readTextFile, stat } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { useI18n } from "@/lib";
import { basename, dirname, htmlDocWithBase, isSupportedTextPath, previewKindForPath, previewMimeForPath, validatePlainTextFile } from "@/lib";

const CLOSE_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const EYE_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ZOOM_IN_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>`;
const ZOOM_OUT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>`;
const FIT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
const ACTUAL_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9z"/></svg>`;

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const CHUNK = 8192;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(chunks.join(""));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type LoadStatus = "loading" | "ready" | "error";

type Props = {
  path: string | null;
  onClose: () => void;
  onOpenAsText: (path: string) => void;
};

export function FilePreviewOverlay({ path, onClose, onOpenAsText }: Props) {
  const { t } = useI18n();
  const kind = useMemo(
    () => (path ? previewKindForPath(path) : "unsupported"),
    [path],
  );

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [size, setSize] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState("");

  // html previews get a <base> pointing at the file's directory (via the asset
  // protocol) so relative images/css/scripts resolve.
  const htmlDoc = useMemo(
    () => (path && kind === "html" ? htmlDocWithBase(text, convertFileSrc(dirname(path))) : ""),
    [path, kind, text],
  );

  const urlRef = useRef<string | null>(null);

  const revokeUrl = useCallback(() => {
    if (urlRef.current && urlRef.current.startsWith("blob:")) {
      URL.revokeObjectURL(urlRef.current);
    }
    urlRef.current = null;
  }, []);

  // Esc to close.
  useEffect(() => {
    if (!path) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [path, onClose]);

  // Load the file payload whenever the target changes.
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    revokeUrl();
    setUrl(null);
    setText("");
    setSize(null);
    setErrMsg("");
    setStatus("loading");

    void (async () => {
      try {
        if (kind === "office" || kind === "unsupported") {
          let s: number | null = null;
          try {
            s = (await stat(path)).size;
          } catch {
            s = null;
          }
          if (cancelled) return;
          setSize(s);
          setStatus("ready");
          return;
        }

        if (kind === "text" || kind === "html") {
          const check = await validatePlainTextFile(path);
          if (cancelled) return;
          if (!check.ok) {
            setErrMsg(check.reason);
            setStatus("error");
            return;
          }
          const content = await readTextFile(path);
          if (cancelled) return;
          setText(content);
          setStatus("ready");
          return;
        }

        // image / video / audio / pdf — read bytes once.
        const bytes = await readFile(path);
        if (cancelled) return;
        if (kind === "pdf") {
          const dataUrl = `data:application/pdf;base64,${bytesToBase64(bytes)}`;
          urlRef.current = dataUrl;
          setUrl(dataUrl);
        } else {
          const blobUrl = URL.createObjectURL(
            new Blob([bytes], { type: previewMimeForPath(path) }),
          );
          urlRef.current = blobUrl;
          setUrl(blobUrl);
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        console.error("marka.md: preview load failed", err);
        setErrMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path, kind, revokeUrl]);

  // Revoke any blob URL on unmount.
  useEffect(() => revokeUrl, [revokeUrl]);

  if (!path) return null;

  const title = basename(path);
  const showOpenAsText = (kind === "text" || kind === "html") && isSupportedTextPath(path) === false;

  return (
    <div
      className="mdv-file-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={t("preview.viewerLabel")}
    >
      <div className="mdv-file-viewer__toolbar">
        <div className="mdv-file-viewer__lead">
          <span className="mdv-file-viewer__badge">
            <span dangerouslySetInnerHTML={{ __html: EYE_ICON_SVG }} />
            {t("preview.badge")}
          </span>
          <span className="mdv-file-viewer__eschint">{t("preview.escHint")}</span>
        </div>
        <span className="mdv-file-viewer__title" title={title}>{title}</span>
        <div className="mdv-file-viewer__actions">
          {showOpenAsText ? (
            <button
              type="button"
              className="mdv-file-viewer__textbtn"
              onClick={() => onOpenAsText(path)}
            >
              {t("app.openAsText")}
            </button>
          ) : null}
          <button
            type="button"
            className="mdv-file-viewer__textbtn"
            onClick={() => void openPath(path).catch(() => undefined)}
          >
            {t("app.openDefault")}
          </button>
          <button
            type="button"
            className="mdv-file-viewer__btn"
            aria-label={t("app.close")}
            data-tooltip={t("app.closeEsc")}
            onClick={onClose}
          >
            <span dangerouslySetInnerHTML={{ __html: CLOSE_ICON_SVG }} />
          </button>
        </div>
      </div>

      <div className="mdv-file-viewer__viewport">
        {status === "loading" ? (
          <div className="mdv-file-viewer__status">{t("preview.loading")}</div>
        ) : status === "error" ? (
          <div className="mdv-file-viewer__status mdv-file-viewer__status--error">
            {errMsg || t("preview.loadFailed")}
          </div>
        ) : kind === "image" && url ? (
          <ImageStage url={url} labels={{
            zoomIn: t("preview.zoomIn"),
            zoomOut: t("preview.zoomOut"),
            fit: t("preview.fit"),
            actual: t("preview.actualSize"),
          }} />
        ) : kind === "video" && url ? (
          <div className="mdv-file-viewer__media">
            <video src={url} controls playsInline />
          </div>
        ) : kind === "audio" && url ? (
          <div className="mdv-file-viewer__media mdv-file-viewer__media--audio">
            <span className="mdv-file-viewer__filename">{title}</span>
            <audio src={url} controls />
          </div>
        ) : kind === "pdf" && url ? (
          <iframe className="mdv-file-viewer__pdf" src={url} title={title} />
        ) : kind === "html" ? (
          <iframe
            className="mdv-file-viewer__html"
            sandbox="allow-scripts"
            srcDoc={htmlDoc}
            title={title}
          />
        ) : kind === "text" ? (
          <pre className="mdv-file-viewer__text">{text}</pre>
        ) : (
          <InfoCard
            title={title}
            kind={kind}
            size={size}
            body={kind === "office" ? t("preview.officeBody") : t("preview.unsupportedBody")}
          />
        )}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  kind,
  size,
  body,
}: {
  title: string;
  kind: string;
  size: number | null;
  body: string;
}) {
  return (
    <div className="mdv-file-viewer__card">
      <div className="mdv-file-viewer__card-name" title={title}>{title}</div>
      <div className="mdv-file-viewer__card-meta">
        {kind === "office" ? "document" : "file"}
        {size != null ? ` · ${formatSize(size)}` : ""}
      </div>
      <p className="mdv-file-viewer__card-body">{body}</p>
    </div>
  );
}

type ImageLabels = {
  zoomIn: string;
  zoomOut: string;
  fit: string;
  actual: string;
};

function ImageStage({ url, labels }: { url: string; labels: ImageLabels }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [fit, setFit] = useState(true);
  const [scale, setScale] = useState(1);

  const zoomBy = useCallback((delta: number) => {
    setFit(false);
    setScale((prev) => clampScale(prev + delta));
  }, []);

  const fitToWindow = useCallback(() => setFit(true), []);
  const actualSize = useCallback(() => {
    setFit(false);
    setScale(1);
  }, []);

  // Pointer-drag pans by adjusting scroll offset (only meaningful when zoomed in).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = vp.scrollLeft;
      startTop = vp.scrollTop;
      vp.classList.add("is-dragging");
      vp.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      vp.scrollLeft = startLeft - (e.clientX - startX);
      vp.scrollTop = startTop - (e.clientY - startY);
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      vp.classList.remove("is-dragging");
      if (vp.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);
    };
    vp.addEventListener("pointerdown", onDown);
    vp.addEventListener("pointermove", onMove);
    vp.addEventListener("pointerup", onUp);
    vp.addEventListener("pointercancel", onUp);
    return () => {
      vp.removeEventListener("pointerdown", onDown);
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerup", onUp);
      vp.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Ctrl/Cmd + wheel to zoom.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || e.deltaY === 0) return;
      e.preventDefault();
      setFit(false);
      setScale((prev) => clampScale(prev + (e.deltaY < 0 ? 0.15 : -0.15)));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  const imgStyle = fit
    ? undefined
    : {
        width: `${Math.max(
          1,
          Math.round((imgRef.current?.naturalWidth ?? 0) * scale),
        )}px`,
        height: `${Math.max(
          1,
          Math.round((imgRef.current?.naturalHeight ?? 0) * scale),
        )}px`,
      };

  return (
    <div className="mdv-file-viewer__image-wrap">
      <div
        ref={viewportRef}
        className={`mdv-file-viewer__image-viewport${fit ? " is-fit" : ""}`}
        onDoubleClick={() => (fit ? actualSize() : fitToWindow())}
      >
        <img
          ref={imgRef}
          className="mdv-file-viewer__image"
          src={url}
          alt=""
          draggable={false}
          style={imgStyle}
        />
      </div>
      <div className="mdv-file-viewer__zoombar">
        <button
          type="button"
          className="mdv-file-viewer__btn"
          aria-label={labels.zoomOut}
          data-tooltip={labels.zoomOut}
          onClick={() => zoomBy(-0.2)}
        >
          <span dangerouslySetInnerHTML={{ __html: ZOOM_OUT_ICON_SVG }} />
        </button>
        <span className="mdv-file-viewer__scale">
          {fit ? labels.fit : `${Math.round(scale * 100)}%`}
        </span>
        <button
          type="button"
          className="mdv-file-viewer__btn"
          aria-label={labels.zoomIn}
          data-tooltip={labels.zoomIn}
          onClick={() => zoomBy(0.2)}
        >
          <span dangerouslySetInnerHTML={{ __html: ZOOM_IN_ICON_SVG }} />
        </button>
        <button
          type="button"
          className="mdv-file-viewer__btn"
          aria-label={labels.fit}
          data-tooltip={labels.fit}
          onClick={fitToWindow}
        >
          <span dangerouslySetInnerHTML={{ __html: FIT_ICON_SVG }} />
        </button>
        <button
          type="button"
          className="mdv-file-viewer__btn"
          aria-label={labels.actual}
          data-tooltip={labels.actual}
          onClick={actualSize}
        >
          <span dangerouslySetInnerHTML={{ __html: ACTUAL_ICON_SVG }} />
        </button>
      </div>
    </div>
  );
}
