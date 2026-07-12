import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { EditorView } from "@codemirror/view";
import { Breadcrumb, StatusBar, TitleBar, type VimMode } from "@/components/chrome";
import { Editor, OpenTabs, Preview, ReadingFind, Splitter, TocPanel } from "@/components/editor";
import { ContextMenu, Sidebar, type ContextMenuItem } from "@/components/files";
import { AboutOverlay, CommandPalette, DropOverlay, HelpOverlay, Toast, WelcomeOverlay } from "@/components/overlays";
import { TooltipRoot } from "@/components/primitives";
import {
  useContextMenu,
  useDebouncedValue,
  useFileOps,
  useFileSession,
  type LoadError,
  useNotifications,
  useOverlays,
  usePersistedState,
  useScrollMemory,
  useSelectionSyncText,
  useShortcuts,
  useSyncScroll,
  useUpdateFlow,
} from "@/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getVersion } from "@tauri-apps/api/app";
import { emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
  basename,
  buildCommands,
  CHANGELOG_URL,
  DEFAULT_WRITING_DISPLAY,
  estimateTokens,
  exportPreviewToPdf,
  formatContextBundle,
  getWritingDisplayVars,
  getContextBundleStats,
  getWhatsNewToastMessage,
  isSupportedTextPath,
  markdownInsertion,
  normalizeProseFontFamily,
  normalizeReadingFontSize,
  normalizeReadingWidth,
  normalizeWritingFontSize,
  normalizeWritingLineHeight,
  PdfExportError,
  pickFolder,
  pickMarkdownFile,
  readContextFiles,
  relativePath,
  removeEntry,
  STORAGE_KEYS,
  useI18n,
  type MarkdownInsertion,
  type ProseFontFamily,
  type ReadingFontSize,
  type ReadingWidth,
  type WritingDisplay,
  type WritingFontSize,
  type WritingLineHeight,
} from "@/lib";
import "./app.css";

type ViewMode = "split" | "reading" | "editor";
type OpenFileRequest = string | {
  path: string;
  waitMarker?: string | null;
};

export function App() {
  const { t } = useI18n();
  const {
    loadError,
    setLoadError,
    dismissLoadError,
    copyPulse,
    copyToast,
    dismissCopyToast,
    saveAsToast,
    dismissSaveAsToast,
    showSaveAsToast,
    copyMarkdown: copyMarkdownCore,
  } = useNotifications();

  // Per-extension preference: 'text' | 'default', remembered until app closes.
  const extPrefs = useRef<Map<string, "text" | "default">>(new Map());
  const loadPlainTextFileRef = useRef<((path: string) => Promise<void>) | undefined>(undefined);
  const waitMarkersRef = useRef<string[]>([]);

  const getExt = useCallback((path: string) => {
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  }, []);

  const isPathWithin = useCallback((child: string, parent: string) => {
    if (child === parent) return true;
    const sep = parent.includes("\\") ? "\\" : "/";
    const prefix = parent.endsWith(sep) ? parent : parent + sep;
    return child.startsWith(prefix);
  }, []);

  const handleLoadError = useCallback((err: LoadError) => {
    if (err.path && err.canOpenAsText) {
      const pref = extPrefs.current.get(getExt(err.path));
      if (pref === "text") {
        void loadPlainTextFileRef.current?.(err.path);
        return;
      }
      if (pref === "default") {
        void openPath(err.path).catch(() => undefined);
        return;
      }
    }
    setLoadError(err);
  }, [getExt, setLoadError]);

  const {
    source,
    setSource,
    savedContent,
    activePath,
    setActivePath,
    tabs,
    activeTabId,
    switchTab,
    closeTab,
    reorderTabs,
    rootPath,
    setRootPath,
    saveStatus,
    recentFiles,
    externalReloadToast,
    dismissExternalReload,
    externalConflict,
    setExternalConflict,
    loadFile,
    loadDemo,
    saveNow,
    saveAs: saveAsCore,
    startNewBuffer,
    loadPlainTextFile,
    dirty,
  } = useFileSession({ onLoadError: handleLoadError });

  useEffect(() => { loadPlainTextFileRef.current = loadPlainTextFile; }, [loadPlainTextFile]);

  const completeWaitSessions = useCallback((markers: string[]) => {
    const unique = Array.from(new Set(markers.filter(Boolean)));
    if (unique.length === 0) return;
    void invoke("complete_wait_sessions", { markers: unique }).catch((err) => {
      console.warn("marka.md: failed to complete wait sessions", err);
    });
  }, []);

  const handleOpenFileRequest = useCallback(async (request: OpenFileRequest) => {
    if (typeof request === "string") {
      if (request.length > 0) await loadFile(request);
      return;
    }
    if (request?.path) {
      await loadFile(request.path, { waitMarker: request.waitMarker });
    }
  }, [loadFile]);

  useEffect(() => {
    waitMarkersRef.current = tabs.flatMap((tab) => tab.waitMarkers);
  }, [tabs]);

  useEffect(() => {
    const onBeforeUnload = () => {
      completeWaitSessions(waitMarkersRef.current);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [completeWaitSessions]);

  const [sidebarOpen, setSidebarOpen] = usePersistedState<boolean>(
    STORAGE_KEYS.sidebarOpen,
    false,
  );
  const [sidebarWidth, setSidebarWidth] = usePersistedState<number>(
    STORAGE_KEYS.sidebarWidth,
    240,
  );
  const [folders, setFolders] = usePersistedState<string[]>(
    STORAGE_KEYS.folders,
    [],
  );
  const [favorites, setFavorites] = usePersistedState<string[]>(
    STORAGE_KEYS.favorites,
    [],
  );
  const didHydrateFoldersRef = useRef(false);

  // migrate the legacy single-folder session into the multi-folder list,
  // and keep useFileSession.rootPath pointed at the first folder so context
  // bundling / save-as / search keep working against a concrete root.
  useEffect(() => {
    if (!didHydrateFoldersRef.current) {
      didHydrateFoldersRef.current = true;
      if (folders.length === 0 && rootPath) {
        setFolders([rootPath]);
        return;
      }
    }
    if (folders.length > 0 && folders[0] !== rootPath) {
      setRootPath(folders[0]);
    } else if (folders.length === 0 && rootPath !== null) {
      setRootPath(null);
    }
  }, [folders, rootPath, setFolders, setRootPath]);

  const handleCloseFolder = useCallback((path: string) => {
    const nextFolders = folders.filter((folder) => folder !== path);
    setFolders(nextFolders);
    setRootPath(nextFolders[0] ?? null);
    if (activePath && isPathWithin(activePath, path)) {
      startNewBuffer();
    }
  }, [
    activePath,
    folders,
    isPathWithin,
    setFolders,
    setRootPath,
    startNewBuffer,
  ]);

  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }, [setFavorites]);

  const reorderFavorites = useCallback((from: number, to: number) => {
    setFavorites((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, [setFavorites]);
  const [titlebarVisible, setTitlebarVisible] = usePersistedState<boolean>(
    STORAGE_KEYS.titlebarVisible,
    true,
  );
  const handleToggleTitlebar = useCallback(() => {
    setTitlebarVisible((v: boolean) => !v);
  }, [setTitlebarVisible]);
  const {
    treeVersion,
    bumpTree,
    editingPath,
    setEditingPath,
    newEntry,
    setNewEntry,
    handleMove,
    handleSubmitRename,
    handleSubmitNew,
    handleUndoFileOp,
  } = useFileOps({
    activePath,
    setActivePath,
    loadFile,
    startNewBuffer,
    onError: setLoadError,
  });

  const {
    paletteOpen,
    setPaletteOpen,
    helpOpen,
    setHelpOpen,
    aboutOpen,
    setAboutOpen,
    welcomeOpen,
    dismissWelcome,
    showWelcome,
    showHelp,
    showAbout,
  } = useOverlays();

  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  const {
    updateAvail,
    setUpdateAvail,
    updateInstalling,
    updateUpToDate,
    setUpdateUpToDate,
    handleApplyUpdate,
    handleManualUpdateCheck,
  } = useUpdateFlow({ onError: setLoadError });

  const [vimOn, setVimOn] = usePersistedState<boolean>(STORAGE_KEYS.vimMode, false);
  const [vimMode, setVimMode] = useState<VimMode | null>(null);
  const [writingFontSize, setWritingFontSize] = usePersistedState<WritingFontSize>(
    STORAGE_KEYS.writingFontSize,
    DEFAULT_WRITING_DISPLAY.fontSize,
  );
  const [writingLineHeight, setWritingLineHeight] = usePersistedState<WritingLineHeight>(
    STORAGE_KEYS.writingLineHeight,
    DEFAULT_WRITING_DISPLAY.lineHeight,
  );
  const [readingFontSize, setReadingFontSize] = usePersistedState<ReadingFontSize>(
    STORAGE_KEYS.readingFontSize,
    DEFAULT_WRITING_DISPLAY.readingFontSize,
  );
  const [readingWidth, setReadingWidth] = usePersistedState<ReadingWidth>(
    STORAGE_KEYS.readingWidth,
    DEFAULT_WRITING_DISPLAY.readingWidth,
  );
  const [proseFontFamily, setProseFontFamily] = usePersistedState<ProseFontFamily>(
    STORAGE_KEYS.proseFontFamily,
    DEFAULT_WRITING_DISPLAY.proseFontFamily,
  );
  const [dragActive, setDragActive] = useState(false);
  const [stagedPaths, setStagedPaths] = useState<string[]>([]);
  const [stagedTokenLabel, setStagedTokenLabel] = useState("0");
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null);

  const writingDisplay = useMemo<WritingDisplay>(
    () => ({
      fontSize: normalizeWritingFontSize(writingFontSize),
      lineHeight: normalizeWritingLineHeight(writingLineHeight),
      readingFontSize: normalizeReadingFontSize(readingFontSize),
      readingWidth: normalizeReadingWidth(readingWidth),
      proseFontFamily: normalizeProseFontFamily(proseFontFamily),
    }),
    [writingFontSize, writingLineHeight, readingFontSize, readingWidth, proseFontFamily],
  );

  const writingDisplayStyle = useMemo(
    () => getWritingDisplayVars(writingDisplay) as CSSProperties,
    [writingDisplay],
  );

  const resetWritingDisplay = useCallback(() => {
    setWritingFontSize(DEFAULT_WRITING_DISPLAY.fontSize);
    setWritingLineHeight(DEFAULT_WRITING_DISPLAY.lineHeight);
    setReadingFontSize(DEFAULT_WRITING_DISPLAY.readingFontSize);
    setReadingWidth(DEFAULT_WRITING_DISPLAY.readingWidth);
    setProseFontFamily(DEFAULT_WRITING_DISPLAY.proseFontFamily);
  }, [setWritingFontSize, setWritingLineHeight, setReadingFontSize, setReadingWidth, setProseFontFamily]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((v: boolean) => !v);
  }, [setSidebarOpen]);

  const exportToPdf = useCallback(async () => {
    try {
      const documentName = tabs.find((tab) => tab.id === activeTabId)?.title;
      await exportPreviewToPdf({ source, activePath, documentName });
    } catch (err) {
      const message = err instanceof PdfExportError
        ? err.message
        : t("app.pdfFailed");
      console.error("marka.md: pdf export failed", err);
      setLoadError({ message });
    }
  }, [source, activePath, tabs, activeTabId, setLoadError, t]);


  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    try {
      const isFs = await win.isFullscreen();
      await win.setFullscreen(!isFs);
    } catch (err) {
      console.error("marka.md: fullscreen toggle failed", err);
    }
  }, []);

  const [viewMode, setViewMode] = usePersistedState<ViewMode>(
    STORAGE_KEYS.viewMode,
    "split",
  );
  const [plainTextEditorOnly, setPlainTextEditorOnly] = useState(false);
  const readingMode = viewMode === "reading" && !plainTextEditorOnly;
  const editorOnly = viewMode === "editor" || plainTextEditorOnly;

  const toggleReadingMode = useCallback(() => {
    setViewMode((current) => (current === "reading" ? "split" : "reading"));
  }, [setViewMode]);
  const exitReadingMode = useCallback(() => setViewMode("split"), [setViewMode]);
  const toggleEditorOnly = useCallback(() => {
    setViewMode((current) => (current === "editor" ? "split" : "editor"));
  }, [setViewMode]);

  // Plain-text fallback files cannot render in preview, so they temporarily force editor-only
  // without changing the user's persisted default view mode.
  useEffect(() => {
    if (!activePath) {
      setPlainTextEditorOnly(false);
      return;
    }
    const lower = activePath.toLowerCase();
    if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".mdx")) {
      setPlainTextEditorOnly(false);
    } else if (extPrefs.current.get(getExt(activePath)) === "text") {
      setPlainTextEditorOnly(true);
    } else {
      setPlainTextEditorOnly(false);
    }
  }, [activePath, getExt]);

  // ⌘F only bound while reading — CM owns it in editor mode.
  const [findOpen, setFindOpen] = useState(false);
  const [findFocusRequest, setFindFocusRequest] = useState(0);
  const [proseEl, setProseEl] = useState<HTMLElement | null>(null);
  const [tocVisible, setTocVisible] = usePersistedState<boolean>(
    STORAGE_KEYS.tocVisible,
    false,
  );
  useEffect(() => {
    if (!readingMode) {
      setProseEl(null);
      setFindOpen(false);
      return;
    }
    // wait one frame for Preview to render its <article class="mdv-prose">
    const id = window.requestAnimationFrame(() => {
      setProseEl(document.querySelector<HTMLElement>(".mdv-prose"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [readingMode]);

  const copyMarkdown = useCallback(() => copyMarkdownCore(source), [copyMarkdownCore, source]);
  const previewWindowTitle = useMemo(() => activePath ? basename(activePath) : "untitled", [activePath]);
  const sendPreviewWindowState = useCallback(async () => {
    await emitTo("preview", "marka:preview-state", {
      source,
      filePath: activePath,
      title: previewWindowTitle,
    });
  }, [activePath, previewWindowTitle, source]);

  const openPreviewWindow = useCallback(async () => {
    try {
      const existing = await WebviewWindow.getByLabel("preview");
      if (existing) {
        await existing.show();
        await existing.unminimize();
        await existing.setFocus();
        await sendPreviewWindowState();
        return;
      }

      const preview = new WebviewWindow("preview", {
        url: "index.html?window=preview",
        title: `${previewWindowTitle} - preview`,
        width: 900,
        height: 720,
        minWidth: 520,
        minHeight: 360,
        decorations: true,
        focus: true,
      });

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const unlisten: Array<() => void> = [];
        const settle = (next: () => void) => {
          if (settled) return;
          settled = true;
          unlisten.forEach((fn) => fn());
          next();
        };

        void preview.once("tauri://created", () => settle(resolve)).then((fn) => unlisten.push(fn));
        void preview.once<unknown>("tauri://error", (event) => {
          settle(() => reject(event.payload));
        }).then((fn) => unlisten.push(fn));
      });
    } catch (err) {
      console.warn("marka.md: preview window failed", err);
      showSaveAsToast(t("title.openPreviewWindowFailed"));
    }
  }, [previewWindowTitle, sendPreviewWindowState, showSaveAsToast, t]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("marka:preview-ready", () => {
      void sendPreviewWindowState().catch(() => undefined);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [sendPreviewWindowState]);

  useEffect(() => {
    void sendPreviewWindowState().catch(() => undefined);
  }, [sendPreviewWindowState]);

  const toggleStagedPath = useCallback((path: string) => {
    setStagedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }, []);

  const clearContextBundle = useCallback(() => setStagedPaths([]), []);

  const copyContextBundle = useCallback(async () => {
    if (stagedPaths.length === 0) {
      setLoadError({ message: t("app.stageFirst") });
      return;
    }
    try {
      const files = await readContextFiles(stagedPaths, activePath, source);
      const bundle = formatContextBundle(files, rootPath);
      const stats = getContextBundleStats(files);
      const filesLabel = stats.files === 1
        ? t("app.fileSingular", { count: stats.files })
        : t("app.filePlural", { count: stats.files });
      await copyMarkdownCore(
        bundle,
        t("app.contextCopied", { files: filesLabel, tokens: stats.formattedTokens }),
      );
    } catch (err) {
      console.error("marka.md: context bundle copy failed", err);
      setLoadError({ message: `${t("app.contextCopyFailed")} — ${String(err)}` });
    }
  }, [stagedPaths, activePath, source, rootPath, copyMarkdownCore, setLoadError, t]);

  const debouncedPreview = useDebouncedValue(source, 50);

  useEffect(() => {
    if (stagedPaths.length === 0) {
      setStagedTokenLabel("0");
      return;
    }
    let cancelled = false;
    void readContextFiles(stagedPaths, activePath, source)
      .then((files) => {
        if (!cancelled) setStagedTokenLabel(getContextBundleStats(files).formattedTokens);
      })
      .catch((err) => {
        console.warn("marka.md: staged context stats failed", err);
        if (!cancelled) setStagedTokenLabel("?");
      });
    return () => {
      cancelled = true;
    };
  }, [stagedPaths, activePath, source]);

  useEffect(() => {
    setStagedPaths([]);
  }, [rootPath]);

  // Keep the webview document title in sync with the active file. On Windows the
  // native Ctrl+P prints the app window, and the browser derives the save-as-PDF
  // default name from document.title — so this drives the exported file name.
  useEffect(() => {
    const tabTitle = tabs.find((tab) => tab.id === activeTabId)?.title;
    document.title = (tabTitle ?? "untitled").replace(/\.md$/i, "");
  }, [tabs, activeTabId]);

  useEffect(() => {
    let cancelled = false;
    void getVersion()
      .then((version) => {
        if (cancelled) return;
        const lastSeen = window.localStorage.getItem(STORAGE_KEYS.lastSeenVersion);
        if (lastSeen && lastSeen !== version) {
          setWhatsNewVersion(version);
        }
        window.localStorage.setItem(STORAGE_KEYS.lastSeenVersion, version);
      })
      .catch((err) => console.warn("marka.md: version check failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const editorViewRef = useRef<EditorView | null>(null);
  const insertMarkdown = useCallback((kind: MarkdownInsertion) => {
    const view = editorViewRef.current;
    if (!view) {
      const insertion = markdownInsertion(kind);
      const prefix = source.length > 0 && !source.endsWith("\n") ? "\n\n" : "";
      setSource(`${source}${prefix}${insertion.text}`);
      return;
    }

    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const insertion = markdownInsertion(kind, selected);
    view.dispatch({
      changes: { from, to, insert: insertion.text },
      selection: {
        anchor: from + insertion.selectionFrom,
        head: from + insertion.selectionTo,
      },
      scrollIntoView: true,
    });
    view.focus();
  }, [setSource, source]);

  // proportional editor <-> preview scroll sync; rebinds when active file changes
  useSyncScroll({ rebindKey: activePath ?? "untitled" });
  useScrollMemory(activePath);
  useSelectionSyncText(editorViewRef, activePath ?? "untitled");

  const { words, minutes, docTokens } = useMemo(() => {
    const trimmed = source.trim();
    const w = trimmed.length ? trimmed.split(/\s+/).length : 0;
    const m = Math.max(1, Math.round(w / 220));
    const t = estimateTokens(source);
    return { words: w, minutes: m, docTokens: t };
  }, [source]);

  // wraps useFileSession's saveAs to bump the sidebar tree + show landing toast.
  const saveAs = useCallback(async () => {
    const target = await saveAsCore();
    if (!target) return;
    bumpTree();
    showSaveAsToast(t("app.savedTo", { name: basename(target) }));
  }, [saveAsCore, bumpTree, showSaveAsToast, t]);

  const handleOpenFolder = useCallback(async () => {
    const folder = await pickFolder();
    if (!folder) return;
    setFolders((prev) => (prev.includes(folder) ? prev : [...prev, folder]));
    setSidebarOpen(true);
  }, [setFolders, setSidebarOpen]);

  const handleOpenFile = useCallback(async () => {
    const file = await pickMarkdownFile();
    if (file) {
      void loadFile(file);
    }
  }, [loadFile]);

  const handleNewFile = useCallback(() => {
    startNewBuffer();
  }, [startNewBuffer]);

  const switchTabByIndex = useCallback((index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    switchTab(tab.id);
  }, [switchTab, tabs]);

  const contextItems = useMemo<ContextMenuItem[]>(() => {
    if (!contextMenu) return [];
    const { path, isDir } = contextMenu;
    const items: ContextMenuItem[] = [
      {
        label: t("menu.rename"),
        onSelect: () => setEditingPath(path),
      },
      "divider",
      {
        label: t("menu.copyPath"),
        onSelect: () => {
          void navigator.clipboard.writeText(path);
          showSaveAsToast(t("menu.pathCopied"));
        },
      },
      {
        label: t("menu.copyRelativePath"),
        onSelect: () => {
          void navigator.clipboard.writeText(relativePath(path, rootPath));
          showSaveAsToast(t("menu.pathCopied"));
        },
      },
    ];
    items.push("divider");
    items.push({
      label: t("menu.revealExplorer"),
      onSelect: () => void invoke("reveal_in_file_manager", { path }),
    });
    if (isDir) {
      items.push("divider");
      items.push({
        label: t("menu.newFile"),
        onSelect: () => setNewEntry({ parent: path, kind: "file" }),
      });
      items.push({
        label: t("menu.newFolder"),
        onSelect: () => setNewEntry({ parent: path, kind: "folder" }),
      });
    } else {
      items.push({
        label: t("menu.openDefault"),
        onSelect: () => void openPath(path),
      });
    }
    items.push("divider");
    items.push({
      label: isDir ? t("menu.deleteFolder") : t("menu.delete"),
      destructive: true,
      onSelect: () => {
        const name = basename(path);
        const msg = isDir
          ? t("menu.confirmDeleteFolder", { name })
          : t("menu.confirmDelete", { name });
        if (!window.confirm(msg)) return;
        void (async () => {
          try {
            await removeEntry(path, isDir);
            // if the deleted file was active, clear the editor back to demo
            if (!isDir && activePath === path) {
              loadDemo();
            }
            // if the deleted folder contained the active file, clear too
            if (isDir && activePath && activePath.startsWith(path + "/")) {
              loadDemo();
            }
            bumpTree();
          } catch (err) {
            console.error("marka.md: delete failed", err);
            setLoadError({ message: `couldn't delete: ${String(err)}` });
          }
        })();
      },
    });
    return items;
  }, [contextMenu, activePath, setActivePath, bumpTree, t]);

  // OS "Open With → marka.md" and CLI launches — Rust emits marka:open-file.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<OpenFileRequest>("marka:open-file", (event) => {
      void handleOpenFileRequest(event.payload);
    }).then((un) => {
      unlisten = un;
      void invoke<OpenFileRequest[]>("take_pending_open_files")
        .then(async (requests) => {
          for (const request of requests) {
            await handleOpenFileRequest(request);
          }
        })
        .catch((err) => {
          console.warn("marka.md: pending open-file check failed", err);
        });
    });
    return () => {
      unlisten?.();
    };
  }, [handleOpenFileRequest]);

  // OS drop via Tauri events (dragDropEnabled: true).
  // Tauri intercepts file drags before the browser sees them, giving us real file paths.
  useEffect(() => {
    type DragPayload = { paths: string[] };
    let unlistenEnter: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;
    let unlistenLeave: (() => void) | undefined;

    void listen<DragPayload>("tauri://drag-enter", (event) => {
      const paths = event.payload.paths ?? [];
      setDragActive(paths.some((p) => isSupportedTextPath(p)));
    }).then((ul) => { unlistenEnter = ul; });

    void listen<DragPayload>("tauri://drag-drop", (event) => {
      setDragActive(false);
      const paths = event.payload.paths ?? [];
      const firstSupported = paths.find((p) => isSupportedTextPath(p));
      if (firstSupported) {
        void loadFile(firstSupported);
      } else if (paths.length > 0) {
        setLoadError({ message: t("app.dropMarkdownOnly") });
      }
    }).then((ul) => { unlistenDrop = ul; });

    void listen("tauri://drag-leave", () => {
      setDragActive(false);
    }).then((ul) => { unlistenLeave = ul; });

    return () => {
      unlistenEnter?.();
      unlistenDrop?.();
      unlistenLeave?.();
    };
  }, [loadFile, setLoadError, t]);

  const handleCloseTab = useCallback((id: string) => {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return;
    if (tab.source !== tab.savedContent && !window.confirm(t("tabs.closeUnsaved", { name: tab.title }))) {
      return;
    }
    completeWaitSessions(tab.waitMarkers);
    closeTab(id);
  }, [closeTab, completeWaitSessions, tabs, t]);

  const shortcuts = useMemo(
    () => ({
      "mod+k": (e: KeyboardEvent) => {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      },
      "mod+/": (e: KeyboardEvent) => {
        e.preventDefault();
        setHelpOpen((v) => !v);
      },
      "mod+b": (e: KeyboardEvent) => {
        e.preventDefault();
        // functional update — avoids stale closure on rapid double-tap when
        // shortcuts memo hasn't rebuilt yet
        setSidebarOpen((v: boolean) => !v);
      },
      "mod+s": (e: KeyboardEvent) => {
        e.preventDefault();
        if (activePath) {
          // existing file — only write if dirty
          if (source !== savedContent) void saveNow(activePath, source);
        } else {
          // untitled buffer — open native save dialog (resolves #17 save half + macOS parity)
          void saveAs();
        }
      },
      "mod+shift+s": (e: KeyboardEvent) => {
        e.preventDefault();
        // explicit "save as" — works on both untitled and existing buffers
        void saveAs();
      },
      "mod+n": (e: KeyboardEvent) => {
        e.preventDefault();
        handleNewFile();
      },
      "mod+t": (e: KeyboardEvent) => {
        e.preventDefault();
        handleNewFile();
      },
      "mod+w": (e: KeyboardEvent) => {
        e.preventDefault();
        handleCloseTab(activeTabId);
      },
      "mod+1": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(0);
      },
      "mod+2": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(1);
      },
      "mod+3": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(2);
      },
      "mod+4": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(3);
      },
      "mod+5": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(4);
      },
      "mod+6": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(5);
      },
      "mod+7": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(6);
      },
      "mod+8": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(7);
      },
      "mod+9": (e: KeyboardEvent) => {
        e.preventDefault();
        switchTabByIndex(8);
      },
      "mod+o": (e: KeyboardEvent) => {
        e.preventDefault();
        void handleOpenFile();
      },
      "mod+shift+o": (e: KeyboardEvent) => {
        e.preventDefault();
        void handleOpenFolder();
      },
      "mod+shift+c": (e: KeyboardEvent) => {
        e.preventDefault();
        void copyMarkdown();
      },
      "mod+p": (e: KeyboardEvent) => {
        e.preventDefault();
        exportToPdf();
      },
      "mod+ctrl+f": (e: KeyboardEvent) => {
        e.preventDefault();
        void toggleFullscreen();
      },
      "mod+.": (e: KeyboardEvent) => {
        e.preventDefault();
        toggleReadingMode();
      },
      "mod+shift+.": (e: KeyboardEvent) => {
        e.preventDefault();
        toggleEditorOnly();
      },
      escape: (e: KeyboardEvent) => {
        if (readingMode) {
          e.preventDefault();
          exitReadingMode();
        }
      },
      // ⌘F / Ctrl+F — only active in reading mode. In editor mode, codemirror
      // owns ⌘F via its searchKeymap (editor.tsx:105).
      ...(readingMode
        ? {
            "mod+f": (e: KeyboardEvent) => {
              e.preventDefault();
              setFindOpen(true);
              setFindFocusRequest((v) => v + 1);
            },
          }
        : {}),
    }),
    [
      activePath,
      activeTabId,
      source,
      savedContent,
      saveNow,
      saveAs,
      handleCloseTab,
      handleOpenFile,
      handleOpenFolder,
      handleNewFile,
      switchTabByIndex,
      handleToggleSidebar,
      copyMarkdown,
      exportToPdf,
      toggleFullscreen,
      readingMode,
      toggleReadingMode,
      exitReadingMode,
      toggleEditorOnly,
    ],
  );
  useShortcuts(shortcuts);

  const commands = useMemo(
    () =>
      buildCommands({
        newFile: handleNewFile,
        openFile: handleOpenFile,
        openFolder: handleOpenFolder,
        save: () => {
          if (activePath && source !== savedContent) {
            void saveNow(activePath, source);
          }
        },
        toggleSidebar: handleToggleSidebar,
        toggleReading: toggleReadingMode,
        showHelp,
        showWelcome,
        showAbout,
        loadDemo,
        undoFileOp: handleUndoFileOp,
        checkForUpdates: handleManualUpdateCheck,
        copyMarkdown,
        copyContextBundle,
        clearContextBundle,
        exportToPdf,
        insertMarkdown,
        toggleFullscreen,
        openRecent: (path: string) => void loadFile(path),
        recentFiles,
        hasActivePath: activePath != null,
        sidebarOpen,
        readingMode,
        editorOnly,
        toggleEditorOnly,
        tocVisible,
        toggleToc: () => setTocVisible((v) => !v),
        contextCount: stagedPaths.length,
      }, t),
    [
      handleNewFile,
      handleOpenFile,
      handleOpenFolder,
      activePath,
      source,
      savedContent,
      saveNow,
      sidebarOpen,
      copyMarkdown,
      copyContextBundle,
      clearContextBundle,
      showHelp,
      showWelcome,
      showAbout,
      loadDemo,
      handleUndoFileOp,
      handleManualUpdateCheck,
      exportToPdf,
      insertMarkdown,
      toggleFullscreen,
      handleToggleSidebar,
      loadFile,
      recentFiles,
      stagedPaths.length,
      tocVisible,
      t,
    ],
  );

  const displayName = activePath ? basename(activePath) : undefined;

  return (
    <div
      className={`mdv-app${sidebarOpen ? " has-sidebar" : ""}${readingMode ? " is-reading" : ""}${!titlebarVisible ? " has-hidden-titlebar" : ""}${writingDisplay.readingWidth === "full" ? " is-reading-width-full" : ""}`}
      style={writingDisplayStyle}
    >
      <TitleBar
        fileName={displayName}
        filePath={activePath}
        dirty={dirty}
        readingMode={readingMode}
        onToggleReading={toggleReadingMode}
        onCopyMarkdown={activePath || source ? () => void copyMarkdown() : undefined}
        copyPulse={copyPulse}
        onExportPdf={exportToPdf}
        vimOn={vimOn}
        onToggleVim={() => setVimOn((v) => !v)}
        writingDisplay={writingDisplay}
        onWritingFontSizeChange={setWritingFontSize}
        onWritingLineHeightChange={setWritingLineHeight}
        onReadingFontSizeChange={setReadingFontSize}
        onReadingWidthChange={setReadingWidth}
        onProseFontFamilyChange={setProseFontFamily}
        onResetWritingDisplay={resetWritingDisplay}
        tocVisible={tocVisible}
        onToggleToc={() => setTocVisible((v) => !v)}
      />

      <Breadcrumb
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        rootPath={rootPath}
        activePath={activePath}
        saveStatus={saveStatus}
        onNewFile={handleNewFile}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onCopyMarkdown={activePath || source ? () => void copyMarkdown() : undefined}
        onExportPdf={exportToPdf}
        copyPulse={copyPulse}
        titlebarVisible={titlebarVisible}
        onToggleTitlebar={handleToggleTitlebar}
        readingMode={readingMode}
        onToggleReading={toggleReadingMode}
        vimOn={vimOn}
        onToggleVim={() => setVimOn((v) => !v)}
        writingDisplay={writingDisplay}
        onWritingFontSizeChange={setWritingFontSize}
        onWritingLineHeightChange={setWritingLineHeight}
        onReadingFontSizeChange={setReadingFontSize}
        onReadingWidthChange={setReadingWidth}
        onProseFontFamilyChange={setProseFontFamily}
        onResetWritingDisplay={resetWritingDisplay}
      />

      <main className="mdv-shell">
        {readingMode ? (
          <>
            <Preview source={debouncedPreview} filePath={activePath} onOpenPreviewWindow={openPreviewWindow} />
            <TocPanel
              open={tocVisible}
              scope={proseEl}
              contentKey={debouncedPreview}
            />
            <ReadingFind
              open={findOpen}
              focusRequest={findFocusRequest}
              onClose={() => setFindOpen(false)}
              scope={proseEl}
              contentKey={debouncedPreview}
            />
          </>
        ) : (
          <>
            <Sidebar
              open={sidebarOpen}
              rootPath={rootPath}
              folders={folders}
              activePath={activePath}
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
              onAddFolder={handleOpenFolder}
              onCloseFolder={handleCloseFolder}
              onSelectFile={(path) => void loadFile(path)}
              onMove={handleMove}
              onContextMenu={handleContextMenu}
              stagedPaths={stagedPaths}
              stagedTokenLabel={stagedTokenLabel}
              onToggleStage={toggleStagedPath}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onReorderFavorites={reorderFavorites}
              onCopyContext={() => void copyContextBundle()}
              onClearContext={clearContextBundle}
              editingPath={editingPath}
              onSubmitRename={handleSubmitRename}
              onCancelEdit={() => setEditingPath(null)}
              newEntry={newEntry}
              onSubmitNew={handleSubmitNew}
              onCancelNew={() => setNewEntry(null)}
              treeVersion={treeVersion}
            />
            <div className="mdv-workspace">
              <OpenTabs
                tabs={tabs}
                activeTabId={activeTabId}
                onSelect={switchTab}
                onClose={handleCloseTab}
                onReorder={reorderTabs}
                onContextMenu={(e, path) => handleContextMenu(e, { path, name: basename(path), isDir: false })}
              />
              {editorOnly ? (
                <div className="mdv-shell__editor-solo">
                  <Editor value={source} onChange={setSource} vimOn={vimOn} onVimMode={setVimMode} viewRef={editorViewRef} />
                </div>
              ) : (
                <Splitter
                  left={<Editor value={source} onChange={setSource} vimOn={vimOn} onVimMode={setVimMode} viewRef={editorViewRef} />}
                  right={<Preview source={debouncedPreview} filePath={activePath} onOpenPreviewWindow={openPreviewWindow} />}
                />
              )}
            </div>
          </>
        )}
      </main>

      <Toast
        open={loadError != null}
        message={loadError?.message ?? ""}
        onDismiss={dismissLoadError}
        action={
          loadError?.path
            ? {
                label: t("app.openDefault"),
                onClick: async () => {
                  if (loadError.path) {
                    if (loadError.canOpenAsText) {
                      extPrefs.current.set(getExt(loadError.path), "default");
                    }
                    try {
                      await openPath(loadError.path);
                    } catch (err) {
                      console.error("marka.md: openPath failed", err);
                    }
                  }
                },
              }
            : undefined
        }
        secondAction={
          loadError?.path && loadError.canOpenAsText
            ? {
                label: t("app.openAsText"),
                onClick: () => {
                  if (loadError.path) {
                    extPrefs.current.set(getExt(loadError.path), "text");
                    void loadPlainTextFile(loadError.path);
                  }
                },
              }
            : undefined
        }
      />

      <Toast
        open={copyToast != null && loadError == null}
        message={copyToast ?? ""}
        variant="info"
        onDismiss={dismissCopyToast}
      />

      <Toast
        open={saveAsToast != null && loadError == null}
        message={saveAsToast ?? ""}
        variant="info"
        onDismiss={dismissSaveAsToast}
      />

      <Toast
        open={updateAvail != null && loadError == null}
        message={
          updateInstalling
            ? t("app.installingVersion", { version: updateAvail?.version ?? "" })
            : t("app.updateAvailable", { version: updateAvail?.version ?? "" })
        }
        variant="info"
        durationMs={null}
        onDismiss={() => setUpdateAvail(null)}
        action={
          updateInstalling
            ? undefined
            : { label: t("app.install"), onClick: () => void handleApplyUpdate() }
        }
      />

      <Toast
        open={updateUpToDate && loadError == null && updateAvail == null}
        message={t("app.latestVersion")}
        variant="info"
        onDismiss={() => setUpdateUpToDate(false)}
      />

      <Toast
        open={whatsNewVersion != null && loadError == null && updateAvail == null}
        message={whatsNewVersion ? getWhatsNewToastMessage(whatsNewVersion) : ""}
        variant="info"
        durationMs={null}
        onDismiss={() => setWhatsNewVersion(null)}
        action={{
          label: t("app.releaseNotes"),
          onClick: () => {
            void openUrl(CHANGELOG_URL);
          },
        }}
      />

      <Toast
        open={externalReloadToast && loadError == null}
        message={t("app.fileReloaded")}
        variant="info"
        onDismiss={dismissExternalReload}
      />

      <Toast
        open={externalConflict != null && loadError == null}
        message={t("app.fileConflict")}
        variant="info"
        durationMs={null}
        onDismiss={() => setExternalConflict(null)}
        action={{
          label: t("app.reloadDiscard"),
          onClick: () => {
            if (externalConflict != null) {
              setSource(externalConflict);
            }
            setExternalConflict(null);
          },
        }}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      <HelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onReplayTutorial={showWelcome}
        onCheckForUpdates={handleManualUpdateCheck}
      />

      <AboutOverlay
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onCheckForUpdates={handleManualUpdateCheck}
      />

      <WelcomeOverlay
        open={welcomeOpen}
        onClose={dismissWelcome}
        onOpenFolder={handleOpenFolder}
      />

      <DropOverlay active={dragActive} />
      <TooltipRoot />

      <ContextMenu
        open={contextMenu != null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        items={contextItems}
        onClose={closeContextMenu}
      />

      <StatusBar
        fileName={displayName}
        words={words}
        minutes={minutes}
        docTokens={docTokens}
        onShowHelp={() => setHelpOpen(true)}
        vimMode={readingMode ? null : vimMode}
      />
    </div>
  );
}
