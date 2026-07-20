export const STORAGE_KEYS = {
  themeMode: "mdview.theme",
  transparency: "mdview.transparency",
  splitterRatio: "mdview.split.ratio",
  sidebarOpen: "mdview.sidebar.open",
  sidebarWidth: "mdview.sidebar.width",
  lastFolder: "mdview.lastFolder",
  lastFile: "mdview.lastFile",
  welcomed: "mdview.welcomed",
  lastSeenVersion: "mdview.lastSeenVersion",
  recentFiles: "mdview.recent.files",
  vimMode: "mdview.vim",
  language: "mdview.language",
  titlebarVisible: "mdview.titlebar.visible",
  folders: "mdview.folders",
  favorites: "mdview.favorites",
  writingFontSize: "mdview.writing.fontSize",
  writingLineHeight: "mdview.writing.lineHeight",
  readingFontSize: "mdview.reading.fontSize",
  readingWidth: "mdview.reading.width",
  proseFontFamily: "mdview.prose.fontFamily",
  viewMode: "mdview.viewMode",
  tocVisible: "mdview.toc.visible",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

type FolderSessionStorage = Pick<Storage, "getItem" | "removeItem">;

export function isFilesystemRoot(path: string): boolean {
  const normalized = path.trim();
  return /^[/\\]+$/.test(normalized) || /^[A-Za-z]:[/\\]*$/.test(normalized);
}

/**
 * Removes a poisoned folder session before React restores either the current
 * multi-folder state or its legacy single-folder fallback.
 */
export function clearUnsafeFolderRestoreState(storage: FolderSessionStorage): boolean {
  let folders: unknown;
  let lastFolder: unknown;
  try {
    const foldersRaw = storage.getItem(STORAGE_KEYS.folders);
    const lastFolderRaw = storage.getItem(STORAGE_KEYS.lastFolder);
    folders = foldersRaw == null ? null : JSON.parse(foldersRaw);
    lastFolder = lastFolderRaw == null ? null : JSON.parse(lastFolderRaw);
  } catch {
    return false;
  }

  const hasUnsafeFolder = Array.isArray(folders)
    && folders.some((path) => typeof path === "string" && isFilesystemRoot(path));
  const hasUnsafeFallback = typeof lastFolder === "string" && isFilesystemRoot(lastFolder);
  if (!hasUnsafeFolder && !hasUnsafeFallback) return false;

  // These keys fall back to each other during hydration, so they must be
  // removed together or the drive root will be restored again.
  try {
    storage.removeItem(STORAGE_KEYS.folders);
  } catch {
    // Continue so the fallback key is still cleared.
  }
  try {
    storage.removeItem(STORAGE_KEYS.lastFolder);
  } catch {
    // Storage failures are non-fatal; the watcher guard remains authoritative.
  }
  return true;
}
