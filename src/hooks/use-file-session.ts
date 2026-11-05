import { useCallback, useEffect, useRef, useState } from "react";
import {
  basename,
  joinPath,
  pathExists,
  pickSaveMarkdown,
  readMarkdown,
  STORAGE_KEYS,
  useI18n,
  validatePlainTextFile,
  validateSupportedTextFile,
  writeMarkdown,
  type StartupMode,
} from "@/lib";
import { DEMO_MARKDOWN } from "@/lib/demo";
import { captureDraftSession, readDraftSession, reconcileRecoveredDraft, writeDraftSession } from "@/lib/drafts";
import type { SaveStatus } from "@/components/chrome";
import { usePersistedState } from "./use-persisted-state";
import { useFileWatcher } from "./use-file-watcher";

const SAVED_FLASH_MS = 1200;
const INITIAL_TAB_ID = "tab-0";
const UNTITLED_TITLE = "untitled";

export type LoadError = { message: string; path?: string; canOpenAsText?: boolean };
export type FileTab = {
  id: string;
  path: string | null;
  title: string;
  source: string;
  savedContent: string;
  waitMarkers: string[];
};

export type LoadFileOptions = {
  waitMarker?: string | null;
};

type UseFileSessionArgs = {
  onLoadError?: (err: LoadError) => void;
  startupMode?: StartupMode;
};

type UseFileSessionResult = {
  source: string;
  setSource: (v: string) => void;
  savedContent: string;
  activePath: string | null;
  setActivePath: (v: string | null | ((p: string | null) => string | null)) => void;
  tabs: FileTab[];
  activeTabId: string;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  reorderTabs: (from: number, to: number) => void;
  rootPath: string | null;
  setRootPath: (v: string | null | ((p: string | null) => string | null)) => void;
  saveStatus: SaveStatus;
  recentFiles: string[];
  setRecentFiles: (v: string[] | ((prev: string[]) => string[])) => void;
  externalReloadToast: boolean;
  dismissExternalReload: () => void;
  externalConflict: string | null;
  setExternalConflict: (v: string | null) => void;
  /** Accept fresh content from disk (external-change reload, "discard mine"). */
  acceptExternalChange: (fresh: string) => void;
  loadFile: (path: string, options?: LoadFileOptions) => Promise<void>;
  loadDemo: () => void;
  saveNow: (path: string, content: string) => Promise<void>;
  /** Picks save location + writes. Returns the chosen path (or null if cancelled). */
  saveAs: () => Promise<string | null>;
  /** Discard buffer, leave activePath null. Accepts optional initial text for OS-drop. */
  startNewBuffer: (initial?: string) => void;
  /** Load any file as plain text, bypassing extension validation. */
  loadPlainTextFile: (path: string) => Promise<void>;
  dirty: boolean;
};

export function useFileSession({ onLoadError, startupMode = "welcome" }: UseFileSessionArgs = {}): UseFileSessionResult {
  const { t } = useI18n();
  const [recovery] = useState(() => {
    try {
      return { session: typeof window === "undefined" ? null : readDraftSession(window.localStorage), failed: false };
    } catch {
      // Preserve an unreadable backup rather than overwriting it with a new session.
      return { session: null, failed: true };
    }
  });
  const recoveredActive = recovery.session?.drafts.find((tab) => tab.id === recovery.session?.activeTabId);
  const initialContent = startupMode === "blank" ? "" : DEMO_MARKDOWN;
  const [source, setSource] = useState<string>(recoveredActive?.source ?? initialContent);
  const [savedContent, setSavedContent] = useState<string>(recoveredActive?.savedContent ?? initialContent);
  const [lastFile, setLastFile] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFile,
    null,
  );
  const [activePath, setActivePath] = useState<string | null>(recoveredActive ? recoveredActive.path : lastFile);
  useEffect(() => setLastFile(activePath), [activePath, setLastFile]);
  const [rootPath, setRootPath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFolder,
    null,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(recoveredActive ? "dirty" : "idle");
  const [recentFiles, setRecentFiles] = usePersistedState<string[]>(
    STORAGE_KEYS.recentFiles,
    [],
  );
  const [externalReloadToast, setExternalReloadToast] = useState(false);
  const [externalConflict, setExternalConflict] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const tabSeq = useRef(1);
  const recoveredIds = useRef(new Set(recovery.session?.drafts.map((tab) => tab.id)));
  const [activeTabId, updateActiveTabId] = useState(recoveredActive?.id ?? INITIAL_TAB_ID);
  const activeTabIdRef = useRef(activeTabId);
  const setActiveTabId = useCallback((id: string) => {
    // A pending save must see a tab switch before React commits the next render.
    activeTabIdRef.current = id;
    updateActiveTabId(id);
  }, []);
  useEffect(() => setExternalConflict(null), [activePath, activeTabId]);
  const [tabs, setTabs] = useState<FileTab[]>(() => recovery.session
    ? recovery.session.drafts.map((draft) => ({
        ...draft,
        title: draft.path ? basename(draft.path) : UNTITLED_TITLE,
        waitMarkers: [],
      }))
    : [
        {
          id: INITIAL_TAB_ID,
          path: null,
          title: UNTITLED_TITLE,
          source: initialContent,
          savedContent: initialContent,
          waitMarkers: [],
        },
      ]);

  const sourceRef = useRef(source);
  const savedRef = useRef(savedContent);
  const activePathRef = useRef(activePath);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    savedRef.current = savedContent;
  }, [savedContent]);
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  const makeTabId = useCallback(() => {
    const next = tabSeq.current;
    tabSeq.current += 1;
    return `tab-${Date.now()}-${next}`;
  }, []);

  const titleForPath = useCallback((path: string | null) => (
    path ? basename(path) : UNTITLED_TITLE
  ), []);

  const appendWaitMarker = useCallback((markers: string[], marker?: string | null) => {
    if (!marker || markers.includes(marker)) return markers;
    return [...markers, marker];
  }, []);

  useEffect(() => {
    setTabs((prev) => prev.map((tab) => {
      if (tab.id !== activeTabId) return tab;
      if (activePath === null) return { ...tab, path: null, title: UNTITLED_TITLE };
      if (!tab.path) return tab;
      return { ...tab, path: activePath, title: titleForPath(activePath) };
    }));
  }, [activePath, activeTabId, titleForPath]);

  const snapshotActiveTab = useCallback((items: FileTab[]) =>
    items.map((tab) => (
      tab.id === activeTabId
        ? {
            ...tab,
            path: tab.path ? activePathRef.current : null,
            title: titleForPath(tab.path ? activePathRef.current : null),
            source: sourceRef.current,
            savedContent: savedRef.current,
          }
        : tab
    )), [activeTabId, titleForPath]);

  const setSourceAndTab = useCallback((next: string) => {
    sourceRef.current = next;
    setSource(next);
    setTabs((prev) => prev.map((tab) => (
      tab.id === activeTabId ? { ...tab, source: next } : tab
    )));
  }, [activeTabId]);

  const dismissExternalReload = useCallback(() => setExternalReloadToast(false), []);

  const acceptExternalChange = useCallback((fresh: string) => {
    recoveredIds.current.delete(activeTabId);
    setSource(fresh);
    setSavedContent(fresh);
    setTabs((prev) => prev.map((tab) => (
      tab.id === activeTabId ? { ...tab, source: fresh, savedContent: fresh } : tab
    )));
    setSaveStatus("idle");
  }, [activeTabId]);

  const switchTab = useCallback((id: string) => {
    const next = snapshotActiveTab(tabs).find((tab) => tab.id === id);
    if (!next) return;
    setTabs((prev) => snapshotActiveTab(prev));
    setActiveTabId(next.id);
    setSource(next.source);
    setSavedContent(next.savedContent);
    setActivePath(next.path);
    setSaveStatus(next.source === next.savedContent ? "idle" : "dirty");
  }, [snapshotActiveTab, setActivePath, tabs]);

  const reorderTabs = useCallback((from: number, to: number) => {
    setTabs((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    const current = snapshotActiveTab(tabs);
    const closingIndex = current.findIndex((tab) => tab.id === id);
    if (closingIndex === -1) return;

    const remaining = current.filter((tab) => tab.id !== id);
    if (remaining.length === 0) {
      const blank: FileTab = {
        id: makeTabId(),
        path: null,
        title: UNTITLED_TITLE,
        source: "",
        savedContent: "",
        waitMarkers: [],
      };
      setTabs([blank]);
      setActiveTabId(blank.id);
      setSource("");
      setSavedContent("");
      setActivePath(null);
      setSaveStatus("idle");
      return;
    }

    setTabs(remaining);
    if (id !== activeTabId) return;
    const next = remaining[Math.min(closingIndex, remaining.length - 1)];
    setActiveTabId(next.id);
    setSource(next.source);
    setSavedContent(next.savedContent);
    setActivePath(next.path);
    setSaveStatus(next.source === next.savedContent ? "idle" : "dirty");
  }, [activeTabId, makeTabId, setActivePath, snapshotActiveTab, tabs]);

  const loadFile = useCallback(
    async (path: string, options: LoadFileOptions = {}) => {
      const seq = ++loadSeq.current;
      const existing = snapshotActiveTab(tabs).find((tab) => tab.path === path);
      if (existing) {
        if (options.waitMarker) {
          setTabs((prev) => snapshotActiveTab(prev).map((tab) => (
            tab.id === existing.id
              ? { ...tab, waitMarkers: appendWaitMarker(tab.waitMarkers, options.waitMarker) }
              : tab
          )));
        }
        if (activePathRef.current !== path) switchTab(existing.id);
        return;
      }
      const check = await validateSupportedTextFile(path);
      if (seq !== loadSeq.current) return;
      if (!check.ok) {
        // Check if it might be openable as plain text despite unsupported extension
        const plainCheck = await validatePlainTextFile(path);
        const canOpenAsText = plainCheck.ok;
        onLoadError?.({ message: check.reason, path, canOpenAsText });
        console.warn("marka.md: refused to open", path, "·", check.reason);
        return;
      }
      try {
        const content = await readMarkdown(path);
        if (seq !== loadSeq.current) return;
        setSource(content);
        setSavedContent(content);
        setActivePath(path);
        const tab: FileTab = {
          id: makeTabId(),
          path,
          title: titleForPath(path),
          source: content,
          savedContent: content,
          waitMarkers: options.waitMarker ? [options.waitMarker] : [],
        };
        setTabs((prev) => [...snapshotActiveTab(prev), tab]);
        setActiveTabId(tab.id);
        setSaveStatus("idle");
        setRecentFiles((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 8));
      } catch (err) {
        console.error("marka.md: readMarkdown failed", err);
        onLoadError?.({ message: String(err), path });
      }
    },
    [
      makeTabId,
      setActivePath,
      setRecentFiles,
      onLoadError,
      snapshotActiveTab,
      switchTab,
      tabs,
      titleForPath,
      appendWaitMarker,
    ],
  );

  const loadDemo = useCallback(() => {
    setSource(DEMO_MARKDOWN);
    setSavedContent(DEMO_MARKDOWN);
    setActivePath(null);
    setTabs((prev) => prev.map((tab) => (
      tab.id === activeTabId
        ? {
            ...tab,
            path: null,
            title: UNTITLED_TITLE,
            source: DEMO_MARKDOWN,
            savedContent: DEMO_MARKDOWN,
            waitMarkers: [],
          }
        : tab
    )));
    setSaveStatus("idle");
  }, [activeTabId, setActivePath]);

  const startNewBuffer = useCallback((initial: string = "") => {
    const tab: FileTab = {
      id: makeTabId(),
      path: null,
      title: UNTITLED_TITLE,
      source: initial,
      savedContent: "",
      waitMarkers: [],
    };
    setSource(initial);
    setSavedContent("");
    setActivePath(null);
    setTabs((prev) => [...snapshotActiveTab(prev), tab]);
    setActiveTabId(tab.id);
    setSaveStatus("idle");
    requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>(".mdv-editor .cm-content");
      editor?.focus();
    });
  }, [makeTabId, setActivePath, snapshotActiveTab]);

  const saveNow = useCallback(async (path: string, content: string) => {
    const savingTabId = activeTabId;
    setSaveStatus("saving");
    try {
      await writeMarkdown(path, content);
      recoveredIds.current.delete(savingTabId);
      setTabs((prev) => prev.map((tab) => (
        tab.id === savingTabId
          ? { ...tab, path, title: titleForPath(path), savedContent: content }
          : tab
      )));
      if (activeTabIdRef.current !== savingTabId) return;
      savedRef.current = content;
      setSavedContent(content);
      setActivePath(path);
      setSaveStatus(sourceRef.current === content ? "saved" : "dirty");
      window.setTimeout(() => {
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, SAVED_FLASH_MS);
    } catch (err) {
      console.error("marka.md: writeMarkdown failed", err);
      if (activeTabIdRef.current === savingTabId) setSaveStatus("dirty");
    }
  }, [activeTabId, titleForPath]);

  const loadPlainTextFile = useCallback(async (path: string) => {
    const seq = ++loadSeq.current;
    const existing = snapshotActiveTab(tabs).find((tab) => tab.path === path);
    if (existing) {
      if (activePathRef.current !== path) switchTab(existing.id);
      return;
    }
    const check = await validatePlainTextFile(path);
    if (seq !== loadSeq.current) return;
    if (!check.ok) {
      onLoadError?.({ message: check.reason, path });
      return;
    }
    try {
      const content = await readMarkdown(path);
      if (seq !== loadSeq.current) return;
      setSource(content);
      setSavedContent(content);
      setActivePath(path);
      const tab: FileTab = {
        id: makeTabId(),
        path,
        title: titleForPath(path),
        source: content,
        savedContent: content,
        waitMarkers: [],
      };
      setTabs((prev) => [...snapshotActiveTab(prev), tab]);
      setActiveTabId(tab.id);
      setSaveStatus("idle");
      setRecentFiles((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 8));
    } catch (err) {
      console.error("marka.md: loadPlainTextFile failed", err);
      onLoadError?.({ message: String(err), path });
    }
  }, [makeTabId, setActivePath, setRecentFiles, onLoadError, snapshotActiveTab, switchTab, tabs, titleForPath]);

  const saveAs = useCallback(async (): Promise<string | null> => {
    const defaultPath = activePath
      ?? (rootPath ? joinPath(rootPath, "untitled.md") : "untitled.md");
    const target = await pickSaveMarkdown(defaultPath);
    if (!target) return null;
    await saveNow(target, source);
    return target;
  }, [activePath, rootPath, source, saveNow]);

  const handleExternalChange = useCallback(async () => {
    if (!activePath) return;
    try {
      const fresh = await readMarkdown(activePath);
      if (activeTabIdRef.current !== activeTabId || activePathRef.current !== activePath) return;
      if (fresh === sourceRef.current || fresh === savedRef.current) return;
      const isDirty = sourceRef.current !== savedRef.current;
      if (!isDirty) {
        setSource(fresh);
        setSavedContent(fresh);
        setTabs((prev) => prev.map((tab) => (
          tab.id === activeTabId ? { ...tab, source: fresh, savedContent: fresh } : tab
        )));
        setExternalReloadToast(true);
        window.setTimeout(() => setExternalReloadToast(false), 2400);
      } else {
        recoveredIds.current.add(activeTabId);
        setExternalConflict(fresh);
      }
    } catch (err) {
      console.error("marka.md: external change reload failed", err);
    }
  }, [activePath, activeTabId]);
  useFileWatcher(activePath, handleExternalChange);

  // mount-only: restore last open file from persisted activePath.
  useEffect(() => {
    if (recovery.session || !activePath) return;
    let cancelled = false;
    void (async () => {
      try {
        const exists = await pathExists(activePath);
        if (cancelled) return;
        if (exists) {
          void loadFile(activePath);
        } else {
          setActivePath(null);
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

  // Keep checking recovered files on activation until saved or explicitly discarded.
  useEffect(() => {
    if (!recoveredIds.current.has(activeTabId) || !activePath) return;
    let cancelled = false;
    void (async () => {
      try {
        const exists = await pathExists(activePath);
        const fresh = exists ? await readMarkdown(activePath) : null;
        if (cancelled || activeTabIdRef.current !== activeTabId) return;
        const result = reconcileRecoveredDraft({
          id: activeTabId, path: activePath, source: sourceRef.current, savedContent: savedRef.current,
        }, fresh);
        if (result.missing) {
          recoveredIds.current.delete(activeTabId);
          setActivePath(null);
          onLoadError?.({ message: t("app.draftFileMissing", { name: basename(activePath) }) });
        } else if (result.conflict !== null) {
          setExternalConflict(result.conflict);
        } else if (result.savedContent !== savedRef.current) {
          acceptExternalChange(result.savedContent);
        }
      } catch {
        if (!cancelled) onLoadError?.({ message: t("app.draftFileReadFailed") });
      }
    })();
    return () => { cancelled = true; };
  }, [activeTabId, activePath, acceptExternalChange, onLoadError, t]);

  const backupFailed = useRef(false);
  const flushDrafts = useRef(() => {});
  flushDrafts.current = () => {
    if (recovery.failed) return;
    try {
      const current = tabs.map((tab) => tab.id === activeTabId
        ? { ...tab, path: activePathRef.current, source: sourceRef.current, savedContent: savedRef.current }
        : tab);
      writeDraftSession(window.localStorage, captureDraftSession(current, activeTabId));
      backupFailed.current = false;
    } catch {
      if (!backupFailed.current) onLoadError?.({ message: t("app.draftBackupFailed") });
      backupFailed.current = true;
    }
  };
  useEffect(() => { flushDrafts.current(); }, [tabs, activeTabId, source, savedContent, activePath]);
  useEffect(() => {
    if (recovery.failed) onLoadError?.({ message: t("app.draftRecoveryFailed") });
  }, [recovery.failed, onLoadError, t]);
  useEffect(() => {
    const flush = () => flushDrafts.current();
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  // mark dirty as soon as content diverges from disk
  useEffect(() => {
    if (!activePath) {
      setSaveStatus(source === savedContent ? "idle" : "dirty");
      return;
    }
    if (source !== savedContent) {
      setSaveStatus((s) => (s === "saving" ? s : "dirty"));
    }
  }, [source, savedContent, activePath]);

  const dirty = source !== savedContent;

  return {
    source,
    setSource: setSourceAndTab,
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
    setRecentFiles,
    externalReloadToast,
    dismissExternalReload,
    externalConflict,
    setExternalConflict,
    acceptExternalChange,
    loadFile,
    loadDemo,
    saveNow,
    saveAs,
    startNewBuffer,
    loadPlainTextFile,
    dirty,
  };
}
