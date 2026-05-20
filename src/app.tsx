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
import { tempDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  basename,
  buildCommands,
  createFolder,
  createMarkdownFile,
  dirname,
  estimateTokens,
  FS_CONFLICT,
  isMarkdownPath,
  joinPath,
  listFolder,
  moveEntry,
  pickFolder,
  pickMarkdownFile,
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

  // undo stack for sidebar file operations — ⌘⌥Z pops + reverses
  type UndoOp =
    | { kind: "move"; from: string; to: string }
    | { kind: "rename"; from: string; to: string }
    | { kind: "create-folder"; path: string }
    | { kind: "create-file"; path: string };
  const undoStackRef = useRef<UndoOp[]>([]);
  const pushUndo = useCallback((op: UndoOp) => {
    const stack = undoStackRef.current;
    stack.push(op);
    if (stack.length > 20) stack.shift();
  }, []);
  const [welcomed, setWelcomed] = usePersistedState<boolean>(STORAGE_KEYS.welcomed, false);
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

  const handleToggleSidebarFromCommands = useCallback(() => {
    setSidebarOpen((v) => !v);
  }, [setSidebarOpen]);

  const exportToPdf = useCallback(async () => {
    // workaround: Tauri 2's WKWebView no-ops window.print(). instead, clone
    // the already-rendered preview article (which has mermaid svgs, katex
    // html, and shiki spans already painted), wrap in a standalone html
    // doc with print-friendly styles, write to OS temp dir, open in the
    // user's default browser. the browser auto-triggers its print dialog
    // on load — user picks "Save as PDF" → real native flow.
    if (!source.trim()) {
      setLoadError({
        message: "nothing to export. open or write some markdown first.",
      });
      return;
    }

    const article = document.querySelector<HTMLElement>(".mdv-prose");
    if (!article) {
      setLoadError({
        message: "preview isn't rendered yet. try again in a moment.",
      });
      return;
    }

    const fileName = activePath ? basename(activePath) : undefined;
    const title = fileName ?? "marka.md export";
    const escapeHtml = (s: string): string =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // self-contained print stylesheet — light theme regardless of app theme.
    // tracks the live prose CSS conceptually but stays decoupled so the
    // exported pdf has a stable "document" look.
    const printStyles = `
      *, *::before, *::after { box-sizing: border-box; }
      :root {
        --pfg: #1d1d1f;
        --pmuted: #6e6e73;
        --paccent: #e2722e;
        --pborder: rgba(0, 0, 0, 0.08);
      }
      html, body {
        background: #fff;
        color: var(--pfg);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
        font-size: 15px;
        line-height: 1.65;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
        /* preserve colors when saving to pdf (e.g. shiki code-block backgrounds) */
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .doc { max-width: 720px; margin: 0 auto; padding: 18mm 16mm 22mm; }
      h1, h2, h3, h4 {
        font-weight: 600;
        letter-spacing: -0.018em;
        /* keep headings on the same page as the first paragraph that follows */
        break-after: avoid;
        page-break-after: avoid;
      }
      h1 { font-size: 2.1em; margin: 0 0 0.5em; }
      h2 { font-size: 1.55em; margin: 2em 0 0.5em; }
      h3 { font-size: 1.25em; margin: 1.6em 0 0.5em; }
      h4 { font-size: 1em; margin: 1.4em 0 0.4em; }
      p, ul, ol, blockquote, pre, table { margin: 0 0 1em; }
      p { orphans: 3; widows: 3; }
      a {
        color: var(--paccent);
        text-decoration: none;
        border-bottom: 1px solid color-mix(in srgb, var(--paccent) 30%, transparent);
      }
      code {
        font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.88em;
        background: rgba(0, 0, 0, 0.045);
        padding: 1px 6px;
        border-radius: 4px;
      }
      pre {
        font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
        font-size: 12.5px;
        line-height: 1.55;
        background: #fafafa;
        border: 1px solid var(--pborder);
        border-radius: 8px;
        padding: 14px 16px;
        overflow-x: auto;
        /* don't split code blocks across pages — looks bad and breaks tokens */
        break-inside: avoid;
        page-break-inside: avoid;
      }
      blockquote, table, .mdv-mermaid {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      img { max-width: 100%; height: auto; border-radius: 6px; break-inside: avoid; }
      pre code { background: transparent; padding: 0; font-size: inherit; border-radius: 0; }
      pre.shiki, pre.shiki * { font-family: inherit; }
      blockquote {
        border-left: 3px solid var(--paccent);
        padding-left: 16px;
        color: var(--pmuted);
        font-style: italic;
      }
      hr { border: none; border-top: 1px solid var(--pborder); margin: 2em 0; }
      ul, ol { padding-left: 24px; }
      li { margin: 0.25em 0; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid var(--pborder); padding: 8px 12px; text-align: left; vertical-align: top; }
      th { background: rgba(0, 0, 0, 0.03); font-weight: 600; }
      /* mermaid renders as inline SVG inside <pre class="mdv-mermaid"> */
      .mdv-mermaid { background: transparent; border: 0; padding: 0; text-align: center; }
      .mdv-mermaid svg { max-width: 100%; height: auto; }
      /* hide in-app affordances that don't belong in print */
      .mdv-copy, .mdv-codeblock > .mdv-copy { display: none !important; }
      /* margin: 0 on @page leaves no room for the browser's auto header /
         footer (title, date, url, page numbers). all visible whitespace is
         pushed into .doc padding instead so it still looks like a margined
         document. users can also uncheck "Headers and footers" in the print
         dialog's "More settings" if their browser still tries to render them. */
      @page { margin: 0; size: auto; }
      @media print {
        body { padding: 0; }
        .doc { padding: 18mm 16mm 22mm; }
      }
    `;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${printStyles}</style>
</head>
<body>
  <main class="doc">
    ${article.outerHTML}
  </main>
  <script>
    // auto-trigger the print dialog once layout settles
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 350);
    });
  </script>
</body>
</html>`;

    try {
      const dir = (await tempDir()).replace(/[\\/]+$/, "");
      const safeName = (fileName ?? "export")
        .replace(/\.md$/i, "")
        .replace(/[^\w.-]+/g, "-")
        .slice(0, 60) || "export";
      // stable name → overwrites on each export instead of piling up in /tmp
      const tempPath = `${dir}/marka-${safeName}.html`;
      await writeMarkdown(tempPath, html);
      await openPath(tempPath);
    } catch (err) {
      console.error("marka.md: pdf export failed", err);
      setLoadError({ message: "couldn't export to pdf — try again, or check disk space" });
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

  // ⌘F find in reading mode (v1.2.0). Codemirror handles its own ⌘F in editor
  // mode; we only bind the shortcut while reading is active. proseRef captures
  // the rendered article element so the find component can walk text nodes.
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

  // external-edit watcher (v1.2.0): poll the active file's mtime and offer to
  // reload when it changes outside marka.md (vim, vscode, etc).
  const [externalReloadToast, setExternalReloadToast] = useState(false);
  const [externalConflict, setExternalConflict] = useState<string | null>(null);

  // tiny "just copied!" pulse for the breadcrumb copy button + ambient toast
  const [copyPulse, setCopyPulse] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
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

  // refs to source + savedContent so handleExternalChange has stable identity.
  // without this, every keystroke recreates the callback → useFileWatcher's
  // effect tears down + restarts the 2s interval, adding a stat() call per
  // keystroke and risking missed external edits during the restart window.
  const sourceRef = useRef(source);
  const savedRef = useRef(savedContent);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    savedRef.current = savedContent;
  }, [savedContent]);

  // external-change handler: re-read the file when its mtime ticks. if user
  // has no unsaved changes, silently reload + show a brief toast. if they DO
  // have dirty edits, surface a conflict toast and let them choose.
  // Stable dep set ([activePath]) — watcher only rebinds when file changes.
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

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [setSidebarOpen, sidebarOpen]);

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

  // ⌘⌥Z (macOS) / Ctrl+Alt+Z (Windows/Linux) global keybinding for file-op undo
  // (doesn't clash with editor ⌘Z / Ctrl+Z). Option/Alt modifies the produced
  // character on macOS (⌥Z = Ω), so we match on e.code which reflects the
  // physical key independent of modifiers.
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

  // OS file drops via HTML5 (Tauri's dragDropEnabled is OFF so the OS-level
  // intercept doesn't fight with the in-app sidebar drag-and-drop).
  // counter pattern: nested elements fire dragenter/leave multiple times, so we
  // increment on enter and decrement on leave. only show overlay when count > 0.
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
        if (activePath && source !== savedContent) {
          void saveNow(activePath, source);
        }
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
      sidebarOpen,
      activePath,
      source,
      savedContent,
      saveNow,
      handleOpenFile,
      handleOpenFolder,
      handleNewFile,
      handleToggleSidebarFromCommands,
      showHelp,
      showWelcome,
      copyMarkdown,
      exportToPdf,
      toggleFullscreen,
      loadFile,
      recentFiles,
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
        toggleSidebar: handleToggleSidebarFromCommands,
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
      setSidebarOpen,
      copyMarkdown,
      showHelp,
      showWelcome,
      showAbout,
      loadDemo,
      handleUndoFileOp,
      handleManualUpdateCheck,
      exportToPdf,
      toggleFullscreen,
      handleToggleSidebarFromCommands,
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
              left={<Editor value={source} onChange={setSource} />}
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

      {/* external-edit watcher: silent reload toast when file changed on disk
          and we had no unsaved local changes. */}
      <Toast
        open={externalReloadToast && loadError == null}
        message="file changed externally · reloaded"
        variant="info"
        onDismiss={() => setExternalReloadToast(false)}
      />

      {/* external-edit watcher: conflict toast when external change collides
          with dirty local edits. user picks which version wins. */}
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
