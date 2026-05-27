import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Circle,
  CircleHelp,
  Copy,
  FilePlus2,
  FileDown,
  Files,
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
import { setThemeMode, setTransparency, THEME_CHOICES, THEME_HINTS, type ThemeMode } from "./theme";
import type { Translate } from "./i18n";

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
  toggleEditorOnly: () => void;
  showHelp: () => void;
  showWelcome: () => void;
  showAbout: () => void;
  loadDemo: () => void;
  undoFileOp: () => void | Promise<void>;
  checkForUpdates: () => void | Promise<void>;
  copyMarkdown: () => void | Promise<void>;
  copyContextBundle: () => void | Promise<void>;
  clearContextBundle: () => void;
  exportToPdf: () => void;
  toggleFullscreen: () => void | Promise<void>;
  openRecent: (path: string) => void;
  recentFiles: readonly string[];
  hasActivePath: boolean;
  sidebarOpen: boolean;
  readingMode: boolean;
  editorOnly: boolean;
  contextCount: number;
};

const THEME_ICONS: Record<ThemeMode, LucideIcon> = {
  system: Monitor,
  latte: Sun,
  mono: Circle,
  "mono-dark": Circle,
  matcha: Leaf,
  frappe: Moon,
  macchiato: Moon,
  mocha: Moon,
  kanagawa: Moon,
  "rose-pine": Moon,
  ayu: Moon,
  claude: Sparkles,
  codex: Moon,
  gemini: Sparkles,
  cursor: Circle,
};

const THEME_COMMANDS: Array<{ mode: ThemeMode; label: string; hint: string; icon: LucideIcon }> =
  THEME_CHOICES.map((theme) => ({
    mode: theme.value,
    label: theme.label,
    hint: THEME_HINTS[theme.value],
    icon: THEME_ICONS[theme.value],
  }));

export const CATEGORY_ORDER: CommandCategory[] = [
  "recent",
  "file",
  "view",
  "edit",
  "share",
  "theme",
  "help",
];

const defaultT: Translate = (key, vars) => {
  if (vars) {
    return key.replace(/\{(\w+)\}/g, (_, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`,
    );
  }
  return key;
};

export function buildCommands(actions: CommandActions, t: Translate = defaultT): Command[] {
  const recent = actions.recentFiles.slice(0, 5).map(
    (path): Command => ({
      id: `recent-${path}`,
      label: basename(path),
      hint: t("command.recentHint", { dir: dirname(path) }),
      icon: FileText,
      category: "recent",
      action: () => actions.openRecent(path),
    }),
  );

  return [
    ...recent,
    {
      id: "open-folder",
      label: t("command.openFolderLabel"),
      hint: t("command.openFolderHint"),
      shortcut: "⌘⇧O",
      icon: FolderPlus,
      category: "file",
      action: actions.openFolder,
    },
    {
      id: "open-file",
      label: t("command.openFileLabel"),
      hint: t("command.openFileHint"),
      shortcut: "⌘O",
      icon: FolderOpen,
      category: "file",
      action: actions.openFile,
    },
    {
      id: "new",
      label: t("app.newFile"),
      hint: t("command.newFileHint"),
      shortcut: "⌘N",
      icon: FilePlus2,
      category: "file",
      action: actions.newFile,
    },
    {
      id: "save",
      label: t("command.save"),
      hint: actions.hasActivePath ? t("command.saveHintReady") : t("command.saveHintEmpty"),
      shortcut: "⌘S",
      icon: Save,
      category: "file",
      action: actions.save,
    },
    {
      id: "undo-file-op",
      label: t("command.undoFileOp"),
      hint: t("command.undoFileOpHint"),
      shortcut: "⌘⌥Z",
      icon: Undo2,
      category: "file",
      action: actions.undoFileOp,
    },
    {
      id: "toggle-sidebar",
      label: actions.sidebarOpen ? t("command.hideSidebar") : t("command.showSidebar"),
      hint: t("command.sidebarHint"),
      shortcut: "⌘B",
      icon: actions.sidebarOpen ? PanelLeftClose : PanelLeftOpen,
      category: "view",
      action: actions.toggleSidebar,
    },
    {
      id: "toggle-reading",
      label: actions.readingMode ? t("command.exitReading") : t("command.enterReading"),
      hint: actions.readingMode
        ? t("command.backToSplit")
        : t("command.readingHint"),
      shortcut: "⌘.",
      icon: actions.readingMode ? Minimize2 : BookOpen,
      category: "view",
      action: actions.toggleReading,
    },
    {
      id: "toggle-editor-only",
      label: actions.editorOnly ? t("command.exitEditorOnly") : t("command.enterEditorOnly"),
      hint: actions.editorOnly
        ? t("command.backToSplit")
        : t("command.editorOnlyHint"),
      shortcut: "⌘⇧.",
      icon: actions.editorOnly ? Minimize2 : FileText,
      category: "view",
      action: actions.toggleEditorOnly,
    },
    {
      id: "fullscreen",
      label: t("command.fullscreen"),
      hint: t("command.fullscreenHint"),
      shortcut: "⌃⌘F",
      icon: Maximize2,
      category: "view",
      action: actions.toggleFullscreen,
    },
    {
      id: "copy-markdown",
      label: t("command.copyMarkdown"),
      hint: t("command.copyMarkdownHint"),
      shortcut: "⌘⇧C",
      icon: Copy,
      category: "share",
      action: actions.copyMarkdown,
    },
    {
      id: "copy-context",
      label: t("command.copyContext"),
      hint: actions.contextCount > 0
        ? t("command.copyContextHint", {
            count: actions.contextCount,
            files: actions.contextCount === 1
              ? t("app.fileSingular", { count: actions.contextCount })
              : t("app.filePlural", { count: actions.contextCount }),
          })
        : t("app.stageFirst"),
      icon: Files,
      category: "share",
      action: actions.copyContextBundle,
    },
    {
      id: "clear-context",
      label: t("command.clearContext"),
      hint: actions.contextCount > 0 ? t("command.clearContextHintReady") : t("command.clearContextHintEmpty"),
      icon: Files,
      category: "share",
      action: actions.clearContextBundle,
    },
    {
      id: "export-pdf",
      label: t("app.exportPdf"),
      hint: t("command.exportPdfHint"),
      shortcut: "⌘P",
      icon: FileDown,
      category: "share",
      action: actions.exportToPdf,
    },
    ...THEME_COMMANDS.map(
      (theme): Command => ({
        id: `theme-${theme.mode}`,
        label: t("command.themePrefix", { theme: theme.label }),
        hint: theme.hint,
        icon: theme.icon,
        category: "theme",
        action: () => setThemeMode(theme.mode),
      }),
    ),
    {
      id: "transparency-on",
      label: t("command.transparencyOn"),
      hint: t("command.transparencyOnHint"),
      icon: Sparkles,
      category: "theme",
      action: () => setTransparency(74),
    },
    {
      id: "transparency-off",
      label: t("command.transparencyOff"),
      hint: t("command.transparencyOffHint"),
      icon: Sparkles,
      category: "theme",
      action: () => setTransparency(100),
    },
    {
      id: "help",
      label: t("command.showHelp"),
      hint: t("command.showHelpHint"),
      shortcut: "⌘/",
      icon: CircleHelp,
      category: "help",
      action: actions.showHelp,
    },
    {
      id: "demo",
      label: t("command.demo"),
      hint: t("command.demoHint"),
      icon: BookOpen,
      category: "help",
      action: actions.loadDemo,
    },
    {
      id: "tutorial",
      label: t("command.tutorial"),
      hint: t("command.tutorialHint"),
      icon: Sparkles,
      category: "help",
      action: actions.showWelcome,
    },
    {
      id: "check-updates",
      label: t("command.checkUpdates"),
      hint: t("command.checkUpdatesHint"),
      icon: Download,
      category: "help",
      action: actions.checkForUpdates,
    },
    {
      id: "about",
      label: t("command.about"),
      hint: t("command.aboutHint"),
      icon: Info,
      category: "help",
      action: actions.showAbout,
    },
  ];
}
