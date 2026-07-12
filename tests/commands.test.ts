import { expect, test } from "bun:test";
import {
  buildCommands,
  type CommandActions,
} from "../src/lib/commands";

const noop = () => undefined;

function commandActions(
  overrides: Partial<CommandActions> = {},
): CommandActions {
  return {
    newFile: noop,
    openFile: noop,
    openFolder: noop,
    save: noop,
    toggleSidebar: noop,
    toggleReading: noop,
    toggleEditorOnly: noop,
    showHelp: noop,
    showWelcome: noop,
    showAbout: noop,
    loadDemo: noop,
    undoFileOp: noop,
    checkForUpdates: noop,
    copyMarkdown: noop,
    copyContextBundle: noop,
    clearContextBundle: noop,
    exportToPdf: noop,
    insertMarkdown: noop,
    toggleFullscreen: noop,
    openRecent: noop,
    recentFiles: [],
    hasActivePath: true,
    sidebarOpen: false,
    readingMode: false,
    editorOnly: false,
    tocVisible: false,
    toggleToc: noop,
    contextCount: 0,
    ...overrides,
  };
}

test("shows the outline command only while reading", () => {
  const splitCommands = buildCommands(commandActions());
  const readingCommands = buildCommands(commandActions({ readingMode: true }));

  expect(splitCommands.some((command) => command.id === "toggle-toc")).toBe(false);
  expect(readingCommands.some((command) => command.id === "toggle-toc")).toBe(true);
});

test("labels the outline command from its current visibility", () => {
  const shown = buildCommands(commandActions({ readingMode: true, tocVisible: true }));
  const hidden = buildCommands(commandActions({ readingMode: true, tocVisible: false }));

  expect(shown.find((command) => command.id === "toggle-toc")?.label).toBe("command.hideToc");
  expect(hidden.find((command) => command.id === "toggle-toc")?.label).toBe("command.showToc");
});

test("includes markdown insertion commands", () => {
  const commands = buildCommands(commandActions());
  const ids = commands.map((command) => command.id);

  expect(ids).toContain("insert-table-2x2");
  expect(ids).toContain("insert-table-3x3");
  expect(ids).toContain("insert-unordered-list");
  expect(ids).toContain("insert-ordered-list");
  expect(ids).toContain("insert-code-block");
});

test("groups layout commands under workspace instead of view", () => {
  const commands = buildCommands(commandActions());

  expect(commands.some((command) => String(command.category) === "view")).toBe(false);
  expect(commands.find((command) => command.id === "toggle-reading")?.category).toBe("workspace");
  expect(commands.find((command) => command.id === "toggle-sidebar")?.category).toBe("workspace");
});
