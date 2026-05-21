import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AboutOverlay,
  Breadcrumb,
  CommandPalette,
  ContextMenu,
  DropOverlay,
  Editor,
  HelpOverlay,
  Preview,
  ReadingFind,
  Sidebar,
  Splitter,
  StatusBar,
  TitleBar,
  Toast,
  WelcomeOverlay,
  type ContextMenuItem,
  type FileEntry,
  type NewEntry,
  type SaveStatus,
} from "@/components/features";
import { TooltipRoot } from "@/components/primitives";
import { useDebouncedValue, useFileWatcher, usePersistedState, useShortcuts, useSyncScroll } from "@/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  basename,
  buildCommands,
  createFolder,
  createMarkdownFile,
  dirname,
  estimateTokens,
  exportPreviewToPdf,
  FS_CONFLICT,
  isMarkdownPath,
  joinPath,
  listFolder,
  pathExists,
  moveEntry,
  PdfExportError,
  pickFolder,
  pickMarkdownFile,
  pickSaveMarkdown,
  readMarkdown,
  removeEntry,
  renameEntry,
  validateMarkdownFile,
  writeMarkdown,
  STORAGE_KEYS,
} from "@/lib";
import { DEMO_MARKDOWN } from "@/lib/demo";
import { applyUpdate, checkForUpdate } from "@/lib/updater";
import "./app.css";

const SAVED_FLASH_MS = 1200;

type UndoOp =
  | { kind: "move"; from: string; to: string }
  | { kind: "rename"; from: string; to: string }
  | { kind: "create-folder"; path: string }
  | { kind: "create-file"; path: string };

export function App() {
  const [source, setSource] = useState<string>(DEMO_MARKDOWN);
  const [savedContent, setSavedContent] = useState<string>(DEMO_MARKDOWN);
  const [activePath, setActivePath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFile,
    null,
  );
  const [rootPath, setRootPath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFolder,
    null,
  );
  const [sidebarOpen, setSidebarOpen] = usePersistedState<boolean>(
    STORAGE_KEYS.sidebarOpen,
    false,
  );
  const [sidebarWidth, setSidebarWidth] = usePersistedState<number>(
    STORAGE_KEYS.sidebarWidth,
    240,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [treeVersion, setTreeVersion] = useState(0);
  const bumpTree = useCallback(() => setTreeVersion((v) => v + 1), []);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
    isDir: boolean;
  } | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<NewEntry | null>(null);
  const [updateAvail, setUpdateAvail] = useState<{ version: string } | null>(null);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateUpToDate, setUpdateUpToDate] = useState(false);

  const undoStackRef = useRef<UndoOp[]>([]);
  const pushUndo = useCallback((op: UndoOp) => {
    const stack = undoStackRef.current;
    stack.push(op);
    if (stack.length > 20) stack.shift();
  }, []);
  const [welcomed, setWelcomed] = usePersistedState<boolean>(STORAGE_KEYS.welcomed, false);
  const [vimOn, setVimOn] = usePersistedState<boolean>(STORAGE_KEYS.vimMode, false);
  const [welcomeOpen, setWelcomeOpen] = useState(!welcomed);
  const [dragActive, setDragActive] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; path?: string } | null>(null);

  const dismissWelcome = useCallback(() => {
    setWelcomeOpen(false);
    setWelcomed(true);
  }, [setWelcomed]);

  const showWelcome = useCallback(() => {
    setWelcomeOpen(true);
  }, []);

  const showHelp = useCallback(() => {
    setHelpOpen(true);
  }, []);

  const showAbout = useCallback(() => {
    setAboutOpen(true);
  }, []);

  const loadDemo = useCallback(() => {
    setSource(DEMO_MARKDOWN);
    setSavedContent(DEMO_MARKDOWN);
    setActivePath(null);
    setSaveStatus("idle");
  }, [setActivePath]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((v: boolean) => !v);
  }, [setSidebarOpen]);

  const exportToPdf = useCallback(async () => {
    try {
      await exportPreviewToPdf({ source, activePath });
    } catch (err) {
      const message = err instanceof PdfExportError
        ? err.message
        : "couldn't export to pdf";
      console.error("marka.md: pdf export failed", err);
      setLoadError({ message });
    }
  }, [source, activePath]);


  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    try {
      const isFs = await win.isFullscreen();
      await win.setFullscreen(!isFs);
    } catch (err) {
      console.error("marka.md: fullscreen toggle failed", err);
    }
  }, []);

  const [recentFiles, setRecentFiles] = usePersistedState<string[]>(
    STORAGE_KEYS.recentFiles,
    [],
  );

  const [readingMode, setReadingMode] = useState(false);
  const toggleReadingMode = useCallback(() => setReadingMode((v) => !v), []);
  const exitReadingMode = useCallback(() => setReadingMode(false), []);

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

  const [externalReloadToast, setExternalReloadToast] = useState(false);
  const [externalConflict, setExternalConflict] = useState<string | null>(null);

  // tiny "just copied!" pulse for the breadcrumb copy button + ambient toast
  const [copyPulse, setCopyPulse] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  // toast shown after a successful save-as so the user knows where the file landed
  const [saveAsToast, setSaveAsToast] = useState<string | null>(null);
  const copyMarkdown = useCallback(async () => {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopyPulse(true);
      setCopyToast(true);
      window.setTimeout(() => setCopyPulse(false), 1200);
      window.setTimeout(() => setCopyToast(false), 1600);
    } catch (err) {
      console.error("marka.md: copy failed", err);
    }
  }, [source]);

  const debouncedPreview = useDebouncedValue(source, 50);

  // proportional editor <-> preview scroll sync; rebinds when active file changes
  useSyncScroll({ rebindKey: activePath ?? "untitled" });

  const { words, minutes, docTokens } = useMemo(() => {
    const trimmed = source.trim();
    const w = trimmed.length ? trimmed.split(/\s+/).length : 0;
    const m = Math.max(1, Math.round(w / 220));
    const t = estimateTokens(source);
    return { words: w, minutes: m, docTokens: t };
  }, [source]);

  const dirty = activePath != null && source !== savedContent;

  const loadFile = useCallback(
    async (path: string) => {
      setLoadError(null);
      const check = await validateMarkdownFile(path);
      if (!check.ok) {
        setLoadError({ message: check.reason, path });
        console.warn("marka.md: refused to open", path, "·", check.reason);
        return;
      }
      try {
        const content = await readMarkdown(path);
        setSource(content);
        setSavedContent(content);
        setActivePath(path);
        setSaveStatus("idle");
        // bump the file to the top of the recent list (dedupe, cap 8)
        setRecentFiles((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 8));
      } catch (err) {
        console.error("marka.md: readMarkdown failed", err);
        setLoadError({ message: String(err), path });
      }
    },
    [setActivePath],
  );

  const saveNow = useCallback(
    async (path: string, content: string) => {
      setSaveStatus("saving");
      try {
        await writeMarkdown(path, content);
        setSavedContent(content);
        setSaveStatus("saved");
        window.setTimeout(() => {
          setSaveStatus((s: SaveStatus) => (s === "saved" ? "idle" : s));
        }, SAVED_FLASH_MS);
      } catch (err) {
        console.error("marka.md: writeMarkdown failed", err);
        setSaveStatus("dirty");
      }
    },
    [],
  );

  const saveAs = useCallback(async () => {
    // suggest a default location: <rootPath>/untitled.md if a folder is open,
    // else just "untitled.md" (dialog will land in the OS default folder)
    const defaultPath = activePath
      ?? (rootPath ? joinPath(rootPath, "untitled.md") : "untitled.md");
    const target = await pickSaveMarkdown(defaultPath);
    if (!target) return; // user cancelled — keep buffer dirty, no error
    await saveNow(target, source);
    setActivePath(target);
    // refresh sidebar in case the file landed inside the currently-open root
    bumpTree();
    // toast so user knows where the file landed
    setSaveAsToast(`saved to ${basename(target)}`);
    window.setTimeout(() => setSaveAsToast(null), 2400);
  }, [activePath, rootPath, source, saveNow, setActivePath]);

  // stable refs so handleExternalChange identity doesn't fluctuate with keystrokes.
  const sourceRef = useRef(source);
  const savedRef = useRef(savedContent);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    savedRef.current = savedContent;
  }, [savedContent]);

  // stable dep set — watcher only rebinds when active file changes.
  const handleExternalChange = useCallback(async () => {
    if (!activePath) return;
    try {
      const fresh = await readMarkdown(activePath);
      if (fresh === sourceRef.current) return; // mtime ticked but content identical — ignore
      const dirty = sourceRef.current !== savedRef.current;
      if (!dirty) {
        setSource(fresh);
        setSavedContent(fresh);
        setExternalReloadToast(true);
        window.setTimeout(() => setExternalReloadToast(false), 2400);
      } else {
        setExternalConflict(fresh);
      }
    } catch (err) {
      console.error("marka.md: external change reload failed", err);
    }
  }, [activePath]);
  useFileWatcher(activePath, handleExternalChange);

  // mount-only: restore last open file from persisted activePath. eslint-disable below is intentional.
  useEffect(() => {
    if (!activePath) return; // no persisted file → demo content stays
    let cancelled = false;
    void (async () => {
      try {
        const exists = await pathExists(activePath);
        if (cancelled) return;
        if (exists) {
          void loadFile(activePath);
        } else {
          setActivePath(null); // stale path — file deleted between sessions
        }
      } catch (err) {
        console.warn("marka.md: session restore failed", err);
        if (!cancelled) setActivePath(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mark dirty as soon as content diverges from disk
  useEffect(() => {
    if (!activePath) {
      setSaveStatus("idle");
      return;
    }
    if (source !== savedContent) {
      setSaveStatus((s: SaveStatus) => (s === "saving" ? s : "dirty"));
    }
  }, [source, savedContent, activePath]);

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
    setSource("");
    setSavedContent("");
    setActivePath(null);
    setSaveStatus("idle");
    // focus the editor on next frame so users can start typing immediately
    requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>(".mdv-editor .cm-content");
      editor?.focus();
    });
  }, [setActivePath]);

  const handleMove = useCallback(
    async (src: string, dstParent: string) => {
      try {
        const newPath = await moveEntry(src, dstParent);
        pushUndo({ kind: "move", from: src, to: newPath });
        bumpTree();
        // if the moved file was the active one, keep editing the new path
        if (activePath === src) setActivePath(newPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          const name = basename(src);
          const target = joinPath(dstParent, name);
          setLoadError({
            message: `${name} already exists at the destination`,
            path: target,
          });
        } else {
          console.error("marka.md: move failed", err);
          setLoadError({ message: `could not move ${basename(src)} — ${msg}` });
        }
      }
    },
    [activePath, bumpTree, pushUndo, setActivePath],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    setContextMenu({ x: e.clientX, y: e.clientY, path: entry.path, isDir: entry.isDir });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleSubmitRename = useCallback(
    async (src: string, newName: string) => {
      setEditingPath(null);
      try {
        const newPath = await renameEntry(src, newName);
        pushUndo({ kind: "rename", from: src, to: newPath });
        bumpTree();
        if (activePath === src) setActivePath(newPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          setLoadError({ message: `${newName} already exists in this folder` });
        } else {
          console.error("marka.md: rename failed", err);
          setLoadError({ message: `could not rename — ${msg}` });
        }
      }
    },
    [activePath, bumpTree, pushUndo, setActivePath],
  );

  const handleSubmitNew = useCallback(
    async (parent: string, kind: "file" | "folder", name: string) => {
      setNewEntry(null);
      try {
        if (kind === "folder") {
          const created = await createFolder(parent, name);
          pushUndo({ kind: "create-folder", path: created });
        } else {
          const created = await createMarkdownFile(parent, name);
          pushUndo({ kind: "create-file", path: created });
          // open the new (empty) file in the editor
          const content = await readMarkdown(created);
          setSource(content);
          setSavedContent(content);
          setActivePath(created);
          setSaveStatus("idle");
        }
        bumpTree();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          setLoadError({ message: `${name} already exists in this folder` });
        } else {
          console.error("marka.md: create failed", err);
          setLoadError({ message: `could not create — ${msg}` });
        }
      }
    },
    [bumpTree, pushUndo, setActivePath],
  );

  const handleUndoFileOp = useCallback(async () => {
    const op = undoStackRef.current.pop();
    if (!op) return;
    try {
      if (op.kind === "move") {
        // move-back across folders: target the original parent dir
        await moveEntry(op.to, dirname(op.from));
        if (activePath === op.to) setActivePath(op.from);
        bumpTree();
        return;
      }
      if (op.kind === "rename") {
        // rename-back in the same folder
        await renameEntry(op.to, basename(op.from));
        if (activePath === op.to) setActivePath(op.from);
        bumpTree();
        return;
      }
      if (op.kind === "create-folder") {
        // only delete if folder still empty (safety)
        const entries = await listFolder(op.path);
        if (entries.length > 0) {
          setLoadError({ message: `can't undo — ${basename(op.path)} has content` });
          return;
        }
        await removeEntry(op.path, true);
        bumpTree();
        return;
      }
      if (op.kind === "create-file") {
        // only delete if file still empty (safety)
        const content = await readMarkdown(op.path);
        if (content.length > 0) {
          setLoadError({ message: `can't undo — ${basename(op.path)} has been edited` });
          return;
        }
        await removeEntry(op.path, false);
        // if the just-deleted file was open in editor, clear
        if (activePath === op.path) {
          setSource("");
          setSavedContent("");
          setActivePath(null);
          setSaveStatus("idle");
        }
        bumpTree();
        return;
      }
    } catch (err) {
      console.error("marka.md: undo failed", err);
      setLoadError({ message: `could not undo — ${err instanceof Error ? err.message : err}` });
    }
  }, [activePath, bumpTree, setActivePath]);

  // ⌥Z produces Ω on macOS — match e.code, not e.key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.altKey && !e.shiftKey && e.code === "KeyZ") {
        e.preventDefault();
        void handleUndoFileOp();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleUndoFileOp]);

  const contextItems = useMemo<ContextMenuItem[]>(() => {
    if (!contextMenu) return [];
    const { path, isDir } = contextMenu;
    const items: ContextMenuItem[] = [
      {
        label: "rename",
        onSelect: () => setEditingPath(path),
      },
    ];
    if (isDir) {
      items.push("divider");
      items.push({
        label: "new file",
        onSelect: () => setNewEntry({ parent: path, kind: "file" }),
      });
      items.push({
        label: "new folder",
        onSelect: () => setNewEntry({ parent: path, kind: "folder" }),
      });
    } else {
      items.push("divider");
      items.push({
        label: "reveal in finder",
        onSelect: () => void openPath(dirname(path)),
      });
      items.push({
        label: "open in default app",
        onSelect: () => void openPath(path),
      });
    }
    items.push("divider");
    items.push({
      label: isDir ? "delete folder" : "delete",
      destructive: true,
      onSelect: () => {
        const name = basename(path);
        const msg = isDir
          ? `delete folder "${name}" and everything inside it?\n\nthis cannot be undone.`
          : `delete "${name}"?\n\nthis cannot be undone.`;
        if (!window.confirm(msg)) return;
        void (async () => {
          try {
            await removeEntry(path, isDir);
            // if the deleted file was active, clear the editor
            if (!isDir && activePath === path) {
              setActivePath(null);
              setSource(DEMO_MARKDOWN);
              setSavedContent(DEMO_MARKDOWN);
            }
            // if the deleted folder contained the active file, clear too
            if (isDir && activePath && activePath.startsWith(path + "/")) {
              setActivePath(null);
              setSource(DEMO_MARKDOWN);
              setSavedContent(DEMO_MARKDOWN);
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
  }, [contextMenu, activePath, setActivePath, bumpTree]);

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
    });
    return () => {
      unlisten?.();
    };
  }, [loadFile]);

  // check for updates once on launch (~1.5s after mount so the editor settles
  // first). Tauri verifies the signature internally — anything not signed by
  // our private updater key is rejected before the toast even appears.
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const result = await checkForUpdate();
      if (result.status === "available") {
        setUpdateAvail({ version: result.version });
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const handleApplyUpdate = useCallback(async () => {
    if (updateInstalling) return;
    setUpdateInstalling(true);
    try {
      await applyUpdate();
      // process will relaunch — control rarely returns here
    } catch (err) {
      console.error("marka.md: update install failed", err);
      setLoadError({
        message: `couldn't install update — ${err instanceof Error ? err.message : err}`,
      });
      setUpdateInstalling(false);
    }
  }, [updateInstalling]);

  const handleManualUpdateCheck = useCallback(async () => {
    const result = await checkForUpdate();
    if (result.status === "available") {
      setUpdateAvail({ version: result.version });
    } else if (result.status === "none") {
      setUpdateUpToDate(true);
    } else {
      setLoadError({ message: `update check failed — ${result.message}` });
    }
  }, []);

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
      const firstMd = files.find((f) => isMarkdownPath(f.name));
      if (firstMd) {
        // WKWebView doesn't expose file path; load content as an untitled buffer.
        try {
          const text = await firstMd.text();
          setSource(text);
          setSavedContent(text);
          setActivePath(null);
          setSaveStatus("idle");
        } catch (err) {
          console.error("marka.md: file drop read failed", err);
          setLoadError({ message: `could not read ${firstMd.name} — ${err}` });
        }
      } else if (files.length > 0) {
        setLoadError({
          message: "only .md / .markdown / .mdx files can be opened in marka.md",
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
  }, [setActivePath]);

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
        exportToPdf,
        toggleFullscreen,
        openRecent: (path: string) => void loadFile(path),
        recentFiles,
        hasActivePath: activePath != null,
        sidebarOpen,
        readingMode,
      }),
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
    ],
  );

  const displayName = activePath ? basename(activePath) : undefined;

  return (
    <div
      className={`mdv-app${sidebarOpen ? " has-sidebar" : ""}${readingMode ? " is-reading" : ""}`}
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
        copyPulse={copyPulse}
      />

      <main className="mdv-shell">
        {readingMode ? (
          <>
            <Preview source={debouncedPreview} />
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
              editingPath={editingPath}
              onSubmitRename={handleSubmitRename}
              onCancelEdit={() => setEditingPath(null)}
              newEntry={newEntry}
              onSubmitNew={handleSubmitNew}
              onCancelNew={() => setNewEntry(null)}
              treeVersion={treeVersion}
            />
            <Splitter
              left={<Editor value={source} onChange={setSource} vimOn={vimOn} />}
              right={<Preview source={debouncedPreview} />}
            />
          </>
        )}
      </main>

      <Toast
        open={loadError != null}
        message={loadError?.message ?? ""}
        onDismiss={() => setLoadError(null)}
        action={
          loadError?.path
            ? {
                label: "open in default app",
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
        open={copyToast && loadError == null}
        message="copied to clipboard · paste anywhere"
        variant="info"
        onDismiss={() => setCopyToast(false)}
      />

      <Toast
        open={saveAsToast != null && loadError == null}
        message={saveAsToast ?? ""}
        variant="info"
        onDismiss={() => setSaveAsToast(null)}
      />

      <Toast
        open={updateAvail != null && loadError == null}
        message={
          updateInstalling
            ? `installing v${updateAvail?.version}…`
            : `update available · v${updateAvail?.version}`
        }
        variant="info"
        durationMs={null}
        onDismiss={() => setUpdateAvail(null)}
        action={
          updateInstalling
            ? undefined
            : { label: "install", onClick: () => void handleApplyUpdate() }
        }
      />

      <Toast
        open={updateUpToDate && loadError == null && updateAvail == null}
        message="you're on the latest version 🐙"
        variant="info"
        onDismiss={() => setUpdateUpToDate(false)}
      />

      <Toast
        open={externalReloadToast && loadError == null}
        message="file changed externally · reloaded"
        variant="info"
        onDismiss={() => setExternalReloadToast(false)}
      />

      <Toast
        open={externalConflict != null && loadError == null}
        message="this file changed externally · your unsaved edits would be lost"
        variant="info"
        durationMs={null}
        onDismiss={() => setExternalConflict(null)}
        action={{
          label: "reload (discard mine)",
          onClick: () => {
            if (externalConflict != null) {
              setSource(externalConflict);
              setSavedContent(externalConflict);
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
      />
    </div>
  );
}
