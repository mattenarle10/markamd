import { useCallback, useEffect, useRef, useState } from "react";
import {
  basename,
  joinPath,
  pathExists,
  pickSaveMarkdown,
  readMarkdown,
  STORAGE_KEYS,
  validatePlainTextFile,
  validateSupportedTextFile,
  writeMarkdown,
} from "@/lib";
import { DEMO_MARKDOWN } from "@/lib/demo";
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
};

type UseFileSessionArgs = {
  onLoadError?: (err: LoadError) => void;
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
  loadFile: (path: string) => Promise<void>;
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

export function useFileSession({ onLoadError }: UseFileSessionArgs = {}): UseFileSessionResult {
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [recentFiles, setRecentFiles] = usePersistedState<string[]>(
    STORAGE_KEYS.recentFiles,
    [],
  );
  const [externalReloadToast, setExternalReloadToast] = useState(false);
  const [externalConflict, setExternalConflict] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const tabSeq = useRef(1);
  const [activeTabId, setActiveTabId] = useState(INITIAL_TAB_ID);
  const [tabs, setTabs] = useState<FileTab[]>([
    {
      id: INITIAL_TAB_ID,
      path: null,
      title: UNTITLED_TITLE,
      source: DEMO_MARKDOWN,
      savedContent: DEMO_MARKDOWN,
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
    setSource(next);
    setTabs((prev) => prev.map((tab) => (
      tab.id === activeTabId ? { ...tab, source: next } : tab
    )));
  }, [activeTabId]);

  const dismissExternalReload = useCallback(() => setExternalReloadToast(false), []);

  const acceptExternalChange = useCallback((fresh: string) => {
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
    async (path: string) => {
      const seq = ++loadSeq.current;
      const existing = snapshotActiveTab(tabs).find((tab) => tab.path === path);
      if (existing) {
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
      savedContent: initial,
    };
    setSource(initial);
    setSavedContent(initial);
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
    setSaveStatus("saving");
    try {
      await writeMarkdown(path, content);
      setSavedContent(content);
      setTabs((prev) => prev.map((tab) => (
        tab.id === activeTabId
          ? { ...tab, path, title: titleForPath(path), source: content, savedContent: content }
          : tab
      )));
      setSaveStatus("saved");
      window.setTimeout(() => {
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, SAVED_FLASH_MS);
    } catch (err) {
      console.error("marka.md: writeMarkdown failed", err);
      setSaveStatus("dirty");
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
    setActivePath(target);
    return target;
  }, [activePath, rootPath, source, saveNow, setActivePath]);

  const handleExternalChange = useCallback(async () => {
    if (!activePath) return;
    try {
      const fresh = await readMarkdown(activePath);
      if (fresh === sourceRef.current) return;
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
        setExternalConflict(fresh);
      }
    } catch (err) {
      console.error("marka.md: external change reload failed", err);
    }
  }, [activePath, activeTabId]);
  useFileWatcher(activePath, handleExternalChange);

  // mount-only: restore last open file from persisted activePath.
  useEffect(() => {
    if (!activePath) return;
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

  // mark dirty as soon as content diverges from disk
  useEffect(() => {
    if (!activePath) {
      setSaveStatus("idle");
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
