import { useEffect, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAppZoom } from "@/hooks/use-app-zoom";
import { Preview } from "./preview";

type PreviewWindowState = {
  source: string;
  filePath?: string | null;
  title?: string;
};

export function PreviewWindow() {
  useAppZoom();
  const [state, setState] = useState<PreviewWindowState>({
    source: "",
    filePath: null,
    title: "preview",
  });

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<PreviewWindowState>("marka:preview-state", (event) => {
      if (cancelled) return;
      setState(event.payload);
      const title = event.payload.title ? `${event.payload.title} - preview` : "preview - marka.md";
      document.title = title;
      void WebviewWindow.getCurrent().setTitle(title);
    }).then((fn) => {
      unlisten = fn;
      return emitTo("main", "marka:preview-ready");
    }).catch((err) => {
      console.warn("marka.md: preview window sync failed", err);
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <div className="mdv-preview-window">
      <Preview source={state.source} filePath={state.filePath ?? null} />
    </div>
  );
}
