import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleHelp,
  Copy,
  FilePlus2,
  FileDown,
  FileText,
  FolderOpen,
  FolderPlus,
  Download,
  Info,
  Leaf,
  Undo2,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Sparkles,
  Sun,
} from "lucide-react";
import { basename, dirname } from "./files";
import { setThemeMode, setTransparency, type ThemeMode } from "./theme";

export type CommandCategory = "recent" | "file" | "view" | "edit" | "share" | "theme" | "help";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon?: LucideIcon;
  category?: CommandCategory;
  action: () => void | Promise<void>;
};

/** Inputs the app shell knows about — actions and state slices needed for hint text. */
export type CommandActions = {
  newFile: () => void;
  openFile: () => void | Promise<void>;
  openFolder: () => void | Promise<void>;
  save: () => void;
  toggleSidebar: () => void;
  toggleReading: () => void;
  showHelp: () => void;
  showWelcome: () => void;
  showAbout: () => void;
  loadDemo: () => void;
  undoFileOp: () => void | Promise<void>;
  checkForUpdates: () => void | Promise<void>;
  copyMarkdown: () => void | Promise<void>;
  exportToPdf: () => void;
  toggleFullscreen: () => void | Promise<void>;
  openRecent: (path: string) => void;
  recentFiles: readonly string[];
  hasActivePath: boolean;
  sidebarOpen: boolean;
  readingMode: boolean;
};

const THEME_COMMANDS: Array<{ mode: ThemeMode; label: string; hint: string; icon: LucideIcon }> = [
  { mode: "system", label: "theme: system", hint: "follow macOS appearance", icon: Monitor },
  { mode: "latte", label: "theme: latte", hint: "catppuccin light", icon: Sun },
  { mode: "matcha", label: "theme: matcha", hint: "washi paper + kelly green", icon: Leaf },
  { mode: "frappe", label: "theme: frappé", hint: "catppuccin mid-dark", icon: Moon },
  { mode: "macchiato", label: "theme: macchiato", hint: "catppuccin deeper dark", icon: Moon },
  { mode: "mocha", label: "theme: mocha", hint: "catppuccin deepest dark", icon: Moon },
];

export const CATEGORY_ORDER: CommandCategory[] = [
  "recent",
  "file",
  "view",
  "edit",
  "share",
  "theme",
  "help",
];

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  recent: "recent",
  file: "file",
  view: "view",
  edit: "edit",
  share: "share",
  theme: "theme",
  help: "help",
};

export function buildCommands(actions: CommandActions): Command[] {
  const recent = actions.recentFiles.slice(0, 5).map(
    (path): Command => ({
      id: `recent-${path}`,
      label: basename(path),
      hint: `recent · ${dirname(path)}`,
      icon: FileText,
      category: "recent",
      action: () => actions.openRecent(path),
    }),
  );

  return [
    ...recent,
    {
      id: "open-folder",
      label: "open folder…",
      hint: "load a folder of notes — turn the sidebar into your context library",
      shortcut: "⌘⇧O",
      icon: FolderPlus,
      category: "file",
      action: actions.openFolder,
    },
    {
      id: "open-file",
      label: "open file…",
      hint: "pick a single .md from disk",
      shortcut: "⌘O",
      icon: FolderOpen,
      category: "file",
      action: actions.openFile,
    },
    {
      id: "new",
      label: "new file",
      hint: "start a blank markdown buffer",
      shortcut: "⌘N",
      icon: FilePlus2,
      category: "file",
      action: actions.newFile,
    },
    {
      id: "save",
      label: "save",
      hint: actions.hasActivePath ? "write changes to disk" : "no file loaded — open one first",
      shortcut: "⌘S",
      icon: Save,
      category: "file",
      action: actions.save,
    },
    {
      id: "undo-file-op",
      label: "undo last file action",
      hint: "reverse the last move / rename / new file / new folder",
      shortcut: "⌘⌥Z",
      icon: Undo2,
      category: "file",
      action: actions.undoFileOp,
    },
    {
      id: "toggle-sidebar",
      label: actions.sidebarOpen ? "hide sidebar" : "show sidebar",
      hint: "your folder tree + file search",
      shortcut: "⌘B",
      icon: actions.sidebarOpen ? PanelLeftClose : PanelLeftOpen,
      category: "view",
      action: actions.toggleSidebar,
    },
    {
      id: "toggle-reading",
      label: actions.readingMode ? "exit reading mode" : "enter reading mode",
      hint: actions.readingMode
        ? "back to split editor + preview"
        : "calm preview-only view — great for proofing before sharing",
      shortcut: "⌘.",
      icon: actions.readingMode ? Minimize2 : BookOpen,
      category: "view",
      action: actions.toggleReading,
    },
    {
      id: "fullscreen",
      label: "toggle fullscreen",
      hint: "native macOS fullscreen",
      shortcut: "⌃⌘F",
      icon: Maximize2,
      category: "view",
      action: actions.toggleFullscreen,
    },
    {
      id: "copy-markdown",
      label: "copy markdown to clipboard",
      hint: "share with any ai — paste straight into chat",
      shortcut: "⌘⇧C",
      icon: Copy,
      category: "share",
      action: actions.copyMarkdown,
    },
    {
      id: "export-pdf",
      label: "export to pdf",
      hint: "macOS print dialog → choose 'save as pdf'",
      shortcut: "⌘P",
      icon: FileDown,
      category: "share",
      action: actions.exportToPdf,
    },
    ...THEME_COMMANDS.map(
      (t): Command => ({
        id: `theme-${t.mode}`,
        label: t.label,
        hint: t.hint,
        icon: t.icon,
        category: "theme",
        action: () => setThemeMode(t.mode),
      }),
    ),
    {
      id: "transparency-on",
      label: "transparency: on (74%)",
      hint: "macOS vibrancy through the window — adjust opacity in theme menu",
      icon: Sparkles,
      category: "theme",
      action: () => setTransparency(74),
    },
    {
      id: "transparency-off",
      label: "transparency: off",
      hint: "solid window background",
      icon: Sparkles,
      category: "theme",
      action: () => setTransparency(100),
    },
    {
      id: "help",
      label: "show help",
      hint: "keyboard shortcuts + tips",
      shortcut: "⌘/",
      icon: CircleHelp,
      category: "help",
      action: actions.showHelp,
    },
    {
      id: "demo",
      label: "show onboarding doc",
      hint: "load the original 'welcome to marka.md' markdown into the editor",
      icon: BookOpen,
      category: "help",
      action: actions.loadDemo,
    },
    {
      id: "tutorial",
      label: "show tutorial · welcome",
      hint: "reopen the onboarding modal",
      icon: Sparkles,
      category: "help",
      action: actions.showWelcome,
    },
    {
      id: "check-updates",
      label: "check for updates",
      hint: "see if there's a newer version of marka.md",
      icon: Download,
      category: "help",
      action: actions.checkForUpdates,
    },
    {
      id: "about",
      label: "about marka.md",
      hint: "version, license, links",
      icon: Info,
      category: "help",
      action: actions.showAbout,
    },
  ];
}
