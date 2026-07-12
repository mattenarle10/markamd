import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Circle,
  CircleHelp,
  Code2,
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
  List,
  ListOrdered,
  Table2,
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

export type CommandCategory = "recent" | "file" | "workspace" | "edit" | "share" | "theme" | "help";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon?: LucideIcon;
  category?: CommandCategory;
  keywords?: string[];
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
  insertMarkdown: (kind: "table-2x2" | "table-3x3" | "unordered-list" | "ordered-list" | "code-block") => void;
  toggleFullscreen: () => void | Promise<void>;
  openRecent: (path: string) => void;
  recentFiles: readonly string[];
  hasActivePath: boolean;
  sidebarOpen: boolean;
  readingMode: boolean;
  editorOnly: boolean;
  tocVisible: boolean;
  toggleToc: () => void;
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
  "workspace",
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
      keywords: ["recent", "history", "open", "file"],
      action: () => actions.openRecent(path),
    }),
  );
  const tocCommands: Command[] = actions.readingMode
    ? [{
        id: "toggle-toc",
        label: actions.tocVisible ? t("command.hideToc") : t("command.showToc"),
        hint: t("command.tocHint"),
        icon: List,
        category: "workspace",
        keywords: ["toc", "outline", "headings", "contents"],
        action: actions.toggleToc,
      }]
    : [];

  return [
    ...recent,
    {
      id: "open-folder",
      label: t("command.openFolderLabel"),
      hint: t("command.openFolderHint"),
      shortcut: "⌘⇧O",
      icon: FolderPlus,
      category: "file",
      keywords: ["folder", "workspace", "library", "notes", "project"],
      action: actions.openFolder,
    },
    {
      id: "open-file",
      label: t("command.openFileLabel"),
      hint: t("command.openFileHint"),
      shortcut: "⌘O",
      icon: FolderOpen,
      category: "file",
      keywords: ["file", "markdown", "md", "csv", "open"],
      action: actions.openFile,
    },
    {
      id: "new",
      label: t("app.newFile"),
      hint: t("command.newFileHint"),
      shortcut: "⌘N",
      icon: FilePlus2,
      category: "file",
      keywords: ["new", "blank", "draft", "untitled"],
      action: actions.newFile,
    },
    {
      id: "save",
      label: t("command.save"),
      hint: actions.hasActivePath ? t("command.saveHintReady") : t("command.saveHintEmpty"),
      shortcut: "⌘S",
      icon: Save,
      category: "file",
      keywords: ["save", "write", "disk"],
      action: actions.save,
    },
    {
      id: "undo-file-op",
      label: t("command.undoFileOp"),
      hint: t("command.undoFileOpHint"),
      shortcut: "⌘⌥Z",
      icon: Undo2,
      category: "file",
      keywords: ["undo", "move", "rename", "file action"],
      action: actions.undoFileOp,
    },
    {
      id: "toggle-sidebar",
      label: actions.sidebarOpen ? t("command.hideSidebar") : t("command.showSidebar"),
      hint: t("command.sidebarHint"),
      shortcut: "⌘B",
      icon: actions.sidebarOpen ? PanelLeftClose : PanelLeftOpen,
      category: "workspace",
      keywords: ["sidebar", "explorer", "tree", "files"],
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
      category: "workspace",
      keywords: ["reading", "preview", "proof", "focus"],
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
      category: "workspace",
      keywords: ["editor", "writing", "focus", "hide preview"],
      action: actions.toggleEditorOnly,
    },
    {
      id: "insert-table-2x2",
      label: t("command.insertTable2x2"),
      hint: t("command.insertTable2x2Hint"),
      icon: Table2,
      category: "edit",
      keywords: ["insert", "table", "grid", "markdown", "rows", "columns"],
      action: () => actions.insertMarkdown("table-2x2"),
    },
    {
      id: "insert-table-3x3",
      label: t("command.insertTable3x3"),
      hint: t("command.insertTable3x3Hint"),
      icon: Table2,
      category: "edit",
      keywords: ["insert", "table", "grid", "markdown", "rows", "columns"],
      action: () => actions.insertMarkdown("table-3x3"),
    },
    {
      id: "insert-unordered-list",
      label: t("command.insertUnorderedList"),
      hint: t("command.insertUnorderedListHint"),
      icon: List,
      category: "edit",
      keywords: ["insert", "list", "bullet", "bullets", "unordered", "markdown"],
      action: () => actions.insertMarkdown("unordered-list"),
    },
    {
      id: "insert-ordered-list",
      label: t("command.insertOrderedList"),
      hint: t("command.insertOrderedListHint"),
      icon: ListOrdered,
      category: "edit",
      keywords: ["insert", "list", "numbered", "numbers", "ordered", "markdown"],
      action: () => actions.insertMarkdown("ordered-list"),
    },
    {
      id: "insert-code-block",
      label: t("command.insertCodeBlock"),
      hint: t("command.insertCodeBlockHint"),
      icon: Code2,
      category: "edit",
      keywords: ["insert", "code", "fence", "block", "markdown", "highlight"],
      action: () => actions.insertMarkdown("code-block"),
    },
    ...tocCommands,
    {
      id: "fullscreen",
      label: t("command.fullscreen"),
      hint: t("command.fullscreenHint"),
      shortcut: "⌃⌘F",
      icon: Maximize2,
      category: "workspace",
      keywords: ["fullscreen", "window", "native"],
      action: actions.toggleFullscreen,
    },
    {
      id: "copy-markdown",
      label: t("command.copyMarkdown"),
      hint: t("command.copyMarkdownHint"),
      shortcut: "⌘⇧C",
      icon: Copy,
      category: "share",
      keywords: ["copy", "markdown", "clipboard", "ai", "chat"],
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
      keywords: ["context", "bundle", "tokens", "stage", "prompt", "ai"],
      action: actions.copyContextBundle,
    },
    {
      id: "clear-context",
      label: t("command.clearContext"),
      hint: actions.contextCount > 0 ? t("command.clearContextHintReady") : t("command.clearContextHintEmpty"),
      icon: Files,
      category: "share",
      keywords: ["clear", "context", "bundle", "stage", "staged"],
      action: actions.clearContextBundle,
    },
    {
      id: "export-pdf",
      label: t("app.exportPdf"),
      hint: t("command.exportPdfHint"),
      shortcut: "⌘P",
      icon: FileDown,
      category: "share",
      keywords: ["pdf", "print", "export", "document"],
      action: actions.exportToPdf,
    },
    ...THEME_COMMANDS.map(
      (theme): Command => ({
        id: `theme-${theme.mode}`,
        label: t("command.themePrefix", { theme: theme.label }),
        hint: theme.hint,
        icon: theme.icon,
        category: "theme",
        keywords: ["theme", "palette", "color", "appearance", theme.mode, theme.label],
        action: () => setThemeMode(theme.mode),
      }),
    ),
    {
      id: "transparency-on",
      label: t("command.transparencyOn"),
      hint: t("command.transparencyOnHint"),
      icon: Sparkles,
      category: "theme",
      keywords: ["transparency", "vibrancy", "opacity", "glass"],
      action: () => setTransparency(74),
    },
    {
      id: "transparency-off",
      label: t("command.transparencyOff"),
      hint: t("command.transparencyOffHint"),
      icon: Sparkles,
      category: "theme",
      keywords: ["transparency", "solid", "opacity", "background"],
      action: () => setTransparency(100),
    },
    {
      id: "help",
      label: t("command.showHelp"),
      hint: t("command.showHelpHint"),
      shortcut: "⌘/",
      icon: CircleHelp,
      category: "help",
      keywords: ["help", "how to", "shortcuts", "manual"],
      action: actions.showHelp,
    },
    {
      id: "demo",
      label: t("command.demo"),
      hint: t("command.demoHint"),
      icon: BookOpen,
      category: "help",
      keywords: ["demo", "welcome", "sample", "onboarding doc"],
      action: actions.loadDemo,
    },
    {
      id: "tutorial",
      label: t("command.tutorial"),
      hint: t("command.tutorialHint"),
      icon: Sparkles,
      category: "help",
      keywords: ["tutorial", "welcome", "quickstart", "onboarding"],
      action: actions.showWelcome,
    },
    {
      id: "check-updates",
      label: t("command.checkUpdates"),
      hint: t("command.checkUpdatesHint"),
      icon: Download,
      category: "help",
      keywords: ["update", "download", "version", "release"],
      action: actions.checkForUpdates,
    },
    {
      id: "about",
      label: t("command.about"),
      hint: t("command.aboutHint"),
      icon: Info,
      category: "help",
      keywords: ["about", "version", "license", "github"],
      action: actions.showAbout,
    },
  ];
}
