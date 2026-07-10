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
