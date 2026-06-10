import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { useI18n } from "@/lib";

const EXPAND_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="M9 21H3v-6"/><path d="m3 21 7-7"/></svg>`;
const ZOOM_IN_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>`;
const ZOOM_OUT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>`;
const FIT_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
const ACTUAL_SIZE_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9z"/></svg>`;
const CLOSE_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

const MIN_DIAGRAM_SCALE = 0.1;
const MAX_DIAGRAM_SCALE = 3;
const DIAGRAM_SCALE_STEP = 0.25;
const DIAGRAM_WHEEL_SCALE_STEP = 0.1;

export type DiagramViewer = {
  svg: string;
  width: number;
  height: number;
  scale: number;
  fit: boolean;
};

export type DiagramViewerSource = Omit<DiagramViewer, "scale" | "fit">;

export type MermaidViewerLabels = {
  open: string;
};

type DiagramViewerOverlayProps = {
  viewer: DiagramViewer;
  onChange: (viewer: DiagramViewer) => void;
  onClose: () => void;
};

type ZoomAnchor = {
  x: number;
  y: number;
};

export function createDiagramViewer(source: DiagramViewerSource): DiagramViewer {
  return { ...source, scale: 1, fit: true };
}

export function DiagramViewerOverlay({ viewer, onChange, onClose }: DiagramViewerOverlayProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);

  const zoomTo = useCallback((scale: number, anchor?: ZoomAnchor | null) => {
    zoomAnchorRef.current = anchor ?? currentViewportAnchor(viewportRef.current);
    onChange({
      ...viewer,
      fit: false,
      scale: clampDiagramScale(scale),
    });
  }, [onChange, viewer]);

  const zoom = useCallback((delta: number) => {
    zoomTo(viewer.scale + delta);
  }, [viewer.scale, zoomTo]);

  const fit = useCallback(() => {
    onChange({ ...viewer, fit: true });
  }, [onChange, viewer]);

  const actualSize = useCallback(() => {
    onChange({ ...viewer, fit: false, scale: 1 });
  }, [onChange, viewer]);

  const wheelZoom = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey || e.deltaY === 0) return;
    e.preventDefault();
    const renderedScale = currentRenderedScale(viewportRef.current, viewer);
    const nextScale = renderedScale + (e.deltaY < 0 ? DIAGRAM_WHEEL_SCALE_STEP : -DIAGRAM_WHEEL_SCALE_STEP);
    zoomTo(nextScale, currentPointerAnchor(viewportRef.current, e.clientX, e.clientY));
  }, [viewer, zoomTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoom(DIAGRAM_SCALE_STEP);
      } else if (e.key === "-") {
        e.preventDefault();
        zoom(-DIAGRAM_SCALE_STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        actualSize();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        fit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [actualSize, fit, onClose, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = viewport.scrollLeft;
      startTop = viewport.scrollTop;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      viewport.scrollLeft = startLeft - (e.clientX - startX);
      viewport.scrollTop = startTop - (e.clientY - startY);
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      viewport.classList.remove("is-dragging");
      if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
    };
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerUp);
    return () => {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", wheelZoom, { passive: false });
    return () => viewport.removeEventListener("wheel", wheelZoom);
  }, [wheelZoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    });
  }, [viewer.svg]);

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    zoomAnchorRef.current = null;
    restoreViewportAnchor(viewportRef.current, anchor);
  }, [viewer.fit, viewer.scale]);

  const diagramStyle = !viewer.fit
    ? {
        width: `${Math.round(viewer.width * viewer.scale)}px`,
        height: `${Math.round(viewer.height * viewer.scale)}px`,
      }
    : undefined;

  return (
    <div className="mdv-diagram-viewer" role="dialog" aria-modal="true" aria-label={t("diagram.viewerLabel")}>
      <div className="mdv-diagram-viewer__toolbar">
        <span className="mdv-diagram-viewer__title">{t("diagram.viewerTitle")}</span>
        <div className="mdv-diagram-viewer__actions">
          <button
            type="button"
            className="mdv-diagram-viewer__btn"
            aria-label={t("diagram.zoomOut")}
            data-tooltip={t("diagram.zoomOut")}
            onClick={() => zoom(-DIAGRAM_SCALE_STEP)}
          >
            <span dangerouslySetInnerHTML={{ __html: ZOOM_OUT_ICON_SVG }} />
          </button>
          <span className="mdv-diagram-viewer__scale">
            {viewer.fit ? t("diagram.fit") : `${Math.round(viewer.scale * 100)}%`}
          </span>
          <button
            type="button"
            className="mdv-diagram-viewer__btn"
            aria-label={t("diagram.zoomIn")}
            data-tooltip={t("diagram.zoomIn")}
            onClick={() => zoom(DIAGRAM_SCALE_STEP)}
          >
            <span dangerouslySetInnerHTML={{ __html: ZOOM_IN_ICON_SVG }} />
          </button>
          <button
            type="button"
            className="mdv-diagram-viewer__btn"
            aria-label={t("diagram.fitToWindow")}
            data-tooltip={t("diagram.fitToWindow")}
            onClick={fit}
          >
            <span dangerouslySetInnerHTML={{ __html: FIT_ICON_SVG }} />
          </button>
          <button
            type="button"
            className="mdv-diagram-viewer__btn"
            aria-label={t("diagram.actualSize")}
            data-tooltip={t("diagram.actualSize")}
            onClick={actualSize}
          >
            <span dangerouslySetInnerHTML={{ __html: ACTUAL_SIZE_ICON_SVG }} />
          </button>
          <button
            type="button"
            className="mdv-diagram-viewer__btn"
            aria-label={t("app.close")}
            data-tooltip={t("app.closeEsc")}
            onClick={onClose}
          >
            <span dangerouslySetInnerHTML={{ __html: CLOSE_ICON_SVG }} />
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="mdv-diagram-viewer__viewport"
        onDoubleClick={onClose}
      >
        <div className="mdv-diagram-viewer__stage">
          <div
            className={`mdv-diagram-viewer__diagram${viewer.fit ? " is-fit" : ""}`}
            style={diagramStyle as CSSProperties | undefined}
            dangerouslySetInnerHTML={{ __html: viewer.svg }}
          />
        </div>
      </div>
    </div>
  );
}

export function decorateMermaidBlocks(
  root: HTMLElement,
  onOpen: (viewer: DiagramViewerSource) => void,
  labels: MermaidViewerLabels,
): () => void {
  const cleanups: Array<() => void> = [];
  const blocks = Array.from(
    root.querySelectorAll<HTMLPreElement>("pre.mdv-mermaid.is-rendered:not(.is-error):not([data-mdv-viewer])"),
  );

  blocks.forEach((pre) => {
    const svg = pre.querySelector<SVGSVGElement>("svg");
    if (!svg) return;

    pre.dataset.mdvViewer = "true";
    pre.setAttribute("title", labels.open);

    const open = () => {
      const freshSvg = pre.querySelector<SVGSVGElement>("svg");
      if (!freshSvg) return;
      onOpen({ svg: freshSvg.outerHTML, ...svgSize(freshSvg) });
    };

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mdv-mermaid__open";
    btn.setAttribute("aria-label", labels.open);
    btn.setAttribute("data-tooltip", labels.open);
    btn.innerHTML = EXPAND_ICON_SVG;
    pre.appendChild(btn);

    const onButtonClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      open();
    };
    const onDoubleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".mdv-mermaid__open")) return;
      e.preventDefault();
      open();
    };

    btn.addEventListener("click", onButtonClick);
    pre.addEventListener("dblclick", onDoubleClick);
    cleanups.push(() => {
      btn.removeEventListener("click", onButtonClick);
      pre.removeEventListener("dblclick", onDoubleClick);
      btn.remove();
      pre.removeAttribute("title");
      delete pre.dataset.mdvViewer;
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

function clampDiagramScale(scale: number): number {
  return Math.min(MAX_DIAGRAM_SCALE, Math.max(MIN_DIAGRAM_SCALE, scale));
}

function currentViewportAnchor(viewport: HTMLDivElement | null): ZoomAnchor | null {
  if (!viewport) return null;
  const rect = viewport.getBoundingClientRect();
  return currentPointerAnchor(viewport, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function currentPointerAnchor(viewport: HTMLDivElement | null, clientX: number, clientY: number): ZoomAnchor | null {
  const diagram = viewport?.querySelector<HTMLElement>(".mdv-diagram-viewer__diagram");
  if (!diagram) return null;
  const rect = diagram.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: clampRatio((clientX - rect.left) / rect.width),
    y: clampRatio((clientY - rect.top) / rect.height),
  };
}

function restoreViewportAnchor(viewport: HTMLDivElement | null, anchor: ZoomAnchor): void {
  const diagram = viewport?.querySelector<HTMLElement>(".mdv-diagram-viewer__diagram");
  if (!viewport || !diagram) return;
  const viewportRect = viewport.getBoundingClientRect();
  const diagramRect = diagram.getBoundingClientRect();
  const viewportCenterX = viewportRect.left + viewportRect.width / 2;
  const viewportCenterY = viewportRect.top + viewportRect.height / 2;
  const anchoredX = diagramRect.left + diagramRect.width * anchor.x;
  const anchoredY = diagramRect.top + diagramRect.height * anchor.y;
  viewport.scrollLeft += anchoredX - viewportCenterX;
  viewport.scrollTop += anchoredY - viewportCenterY;
}

function currentRenderedScale(viewport: HTMLDivElement | null, viewer: DiagramViewer): number {
  if (!viewer.fit) return viewer.scale;
  const diagram = viewport?.querySelector<HTMLElement>(".mdv-diagram-viewer__diagram");
  const width = diagram?.getBoundingClientRect().width ?? 0;
  return width > 0 ? width / viewer.width : viewer.scale;
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }
  const attrWidth = Number.parseFloat(svg.getAttribute("width") ?? "");
  const attrHeight = Number.parseFloat(svg.getAttribute("height") ?? "");
  if (Number.isFinite(attrWidth) && attrWidth > 0 && Number.isFinite(attrHeight) && attrHeight > 0) {
    return { width: attrWidth, height: attrHeight };
  }
  const rect = svg.getBoundingClientRect();
  return { width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) };
}
