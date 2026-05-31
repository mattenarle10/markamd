import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumb, StatusBar, TitleBar, type VimMode } from "@/components/chrome";
import { Editor, OpenTabs, Preview, ReadingFind, Splitter } from "@/components/editor";
import { ContextMenu, Sidebar, type ContextMenuItem } from "@/components/files";
import { AboutOverlay, CommandPalette, DropOverlay, HelpOverlay, Toast, WelcomeOverlay } from "@/components/overlays";
import { TooltipRoot } from "@/components/primitives";
import {
  useContextMenu,
  useDebouncedValue,
  useFileOps,
  useFileSession,
  useNotifications,
  useOverlays,
  usePersistedState,
  useShortcuts,
  useSyncScroll,
  useUpdateFlow,
} from "@/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
  basename,
  buildCommands,
  CHANGELOG_URL,
  estimateTokens,
  exportPreviewToPdf,
  formatContextBundle,
  getContextBundleStats,
  getWhatsNewToastMessage,
  isSupportedTextPath,
  PdfExportError,
  pickFolder,
  pickMarkdownFile,
  readContextFiles,
  relativePath,
  removeEntry,
  STORAGE_KEYS,
  useI18n,
} from "@/lib";
import "./app.css";

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
    dirty,
  } = useFileSession({ onLoadError: setLoadError });

  const [sidebarOpen, setSidebarOpen] = usePersistedState<boolean>(
    STORAGE_KEYS.sidebarOpen,
    false,
  );
  const [sidebarWidth, setSidebarWidth] = usePersistedState<number>(
    STORAGE_KEYS.sidebarWidth,
    240,
  );
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
  const [dragActive, setDragActive] = useState(false);
  const [stagedPaths, setStagedPaths] = useState<string[]>([]);
  const [stagedTokenLabel, setStagedTokenLabel] = useState("0");
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((v: boolean) => !v);
  }, [setSidebarOpen]);

  const exportToPdf = useCallback(async () => {
    try {
      await exportPreviewToPdf({ source, activePath });
    } catch (err) {
      const message = err instanceof PdfExportError
        ? err.message
        : t("app.pdfFailed");
      console.error("marka.md: pdf export failed", err);
      setLoadError({ message });
    }
  }, [source, activePath, setLoadError, t]);


  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    try {
      const isFs = await win.isFullscreen();
      await win.setFullscreen(!isFs);
    } catch (err) {
      console.error("marka.md: fullscreen toggle failed", err);
    }
  }, []);

  const [readingMode, setReadingMode] = useState(false);
  const [editorOnly, setEditorOnly] = useState(false);
  // reading + editor-only are mutually exclusive view modes
  const toggleReadingMode = useCallback(() => {
    setReadingMode((v) => {
      const next = !v;
      if (next) setEditorOnly(false);
      return next;
    });
  }, []);
  const exitReadingMode = useCallback(() => setReadingMode(false), []);
  const toggleEditorOnly = useCallback(() => {
    setEditorOnly((v) => {
      const next = !v;
      if (next) setReadingMode(false);
      return next;
    });
  }, []);

  // ⌘F only bound while reading — CM owns it in editor mode.
  const [findOpen, setFindOpen] = useState(false);
  const [proseEl, setProseEl] = useState<HTMLElement | null>(null);
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

  // proportional editor <-> preview scroll sync; rebinds when active file changes
  useSyncScroll({ rebindKey: activePath ?? "untitled" });

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
    if (folder) {
      setRootPath(folder);
      setSidebarOpen(true);
    }
  }, [setRootPath, setSidebarOpen]);

  const handleOpenFile = useCallback(async () => {
    const file = await pickMarkdownFile();
    if (file) {
      void loadFile(file);
    }
  }, [loadFile]);

  const handleNewFile = useCallback(() => {
    startNewBuffer();
  }, [startNewBuffer]);

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

  // OS "Open With → marka.md" from Finder — Rust emits marka:open-file
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("marka:open-file", (event) => {
      const path = event.payload;
      if (typeof path === "string" && path.length > 0) {
        void loadFile(path);
      }
    }).then((un) => {
      unlisten = un;
      void invoke<string[]>("take_pending_open_files")
        .then((paths) => {
          const latest = paths[paths.length - 1];
          if (latest) void loadFile(latest);
        })
        .catch((err) => {
          console.warn("marka.md: pending open-file check failed", err);
        });
    });
    return () => {
      unlisten?.();
    };
  }, [loadFile]);

  // OS drop. dragDropEnabled is OFF so Tauri doesn't intercept. counter guards
  // nested dragenter/leave firing multiple times.
  useEffect(() => {
    let enterCount = 0;

    const isOsFileDrag = (e: DragEvent) => {
      if (!e.dataTransfer) return false;
      // never engage on in-app sidebar drags
      if (e.dataTransfer.types.includes("application/x-marka-path")) return false;
      return e.dataTransfer.types.includes("Files");
    };

    const reset = () => {
      enterCount = 0;
      setDragActive(false);
    };

    const onDragEnter = (e: DragEvent) => {
      if (!isOsFileDrag(e)) return;
      enterCount += 1;
      if (enterCount === 1) setDragActive(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!isOsFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!isOsFileDrag(e)) return;
      enterCount = Math.max(0, enterCount - 1);
      if (enterCount === 0) setDragActive(false);
    };

    const onDrop = async (e: DragEvent) => {
      if (!isOsFileDrag(e)) {
        // safety: any drop that lands on window resets state
        reset();
        return;
      }
      e.preventDefault();
      reset();
      const files = Array.from(e.dataTransfer?.files ?? []);
      const firstSupported = files.find((f) => isSupportedTextPath(f.name));
      if (firstSupported) {
        // WKWebView doesn't expose file path; load content as an untitled buffer.
        try {
          const text = await firstSupported.text();
          startNewBuffer(text);
        } catch (err) {
          console.error("marka.md: file drop read failed", err);
          setLoadError({ message: `could not read ${firstSupported.name} — ${err}` });
        }
      } else if (files.length > 0) {
        setLoadError({
          message: t("app.dropMarkdownOnly"),
        });
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    // safety: any of these end the drag for sure — keeps state from sticking
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
    };
  }, [setLoadError, startNewBuffer, t]);

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
            },
          }
        : {}),
    }),
    [
      activePath,
      source,
      savedContent,
      saveNow,
      saveAs,
      handleOpenFile,
      handleOpenFolder,
      handleNewFile,
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
        toggleFullscreen,
        openRecent: (path: string) => void loadFile(path),
        recentFiles,
        hasActivePath: activePath != null,
        sidebarOpen,
        readingMode,
        editorOnly,
        toggleEditorOnly,
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
      toggleFullscreen,
      handleToggleSidebar,
      loadFile,
      recentFiles,
      stagedPaths.length,
      t,
    ],
  );

  const displayName = activePath ? basename(activePath) : undefined;

  const handleCloseTab = useCallback((id: string) => {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return;
    if (tab.source !== tab.savedContent && !window.confirm(t("tabs.closeUnsaved", { name: tab.title }))) {
      return;
    }
    closeTab(id);
  }, [closeTab, tabs, t]);

  return (
    <div
      className={`mdv-app${sidebarOpen ? " has-sidebar" : ""}${readingMode ? " is-reading" : ""}${!titlebarVisible ? " has-hidden-titlebar" : ""}`}
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
      />

      <main className="mdv-shell">
        {readingMode ? (
          <>
            <Preview source={debouncedPreview} filePath={activePath} />
            <ReadingFind
              open={findOpen}
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
              activePath={activePath}
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
              onOpenFolder={handleOpenFolder}
              onSelectFile={(path) => void loadFile(path)}
              onMove={handleMove}
              onContextMenu={handleContextMenu}
              stagedPaths={stagedPaths}
              stagedTokenLabel={stagedTokenLabel}
              onToggleStage={toggleStagedPath}
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
              />
              {editorOnly ? (
                <div className="mdv-shell__editor-solo">
                  <Editor value={source} onChange={setSource} vimOn={vimOn} onVimMode={setVimMode} />
                </div>
              ) : (
                <Splitter
                  left={<Editor value={source} onChange={setSource} vimOn={vimOn} onVimMode={setVimMode} />}
                  right={<Preview source={debouncedPreview} filePath={activePath} />}
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
