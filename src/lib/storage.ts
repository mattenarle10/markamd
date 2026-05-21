export const STORAGE_KEYS = {
  themeMode: "mdview.theme",
  transparency: "mdview.transparency",
  splitterRatio: "mdview.split.ratio",
  sidebarOpen: "mdview.sidebar.open",
  sidebarWidth: "mdview.sidebar.width",
  lastFolder: "mdview.lastFolder",
  lastFile: "mdview.lastFile",
  welcomed: "mdview.welcomed",
  recentFiles: "mdview.recent.files",
  vimMode: "mdview.vim",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
