import { expect, test } from "bun:test";
import { getFullscreenShortcut, matchesShortcut } from "../src/lib/shortcuts";

function keyEvent(overrides: Partial<KeyboardEvent> = {}) {
  return {
    key: "f",
    code: "KeyF",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

test("Windows/Linux Ctrl+F is reserved for find and F11 toggles fullscreen", () => {
  const fullscreen = getFullscreenShortcut(false);
  const find = keyEvent({ ctrlKey: true });
  const f11 = keyEvent({ key: "F11", code: "F11" });

  expect(matchesShortcut("mod+f", find, false)).toBe(true);
  expect(matchesShortcut(fullscreen.binding, find, false)).toBe(false);
  expect(matchesShortcut(fullscreen.binding, f11, false)).toBe(true);
  expect(matchesShortcut("mod+f", f11, false)).toBe(false);
  expect(fullscreen.label).toBe("F11");
  expect(fullscreen.keys).toBe("F11");
});

test("macOS Cmd+F finds and Ctrl+Cmd+F toggles fullscreen", () => {
  const fullscreen = getFullscreenShortcut(true);
  const find = keyEvent({ metaKey: true });
  const toggle = keyEvent({ metaKey: true, ctrlKey: true });

  expect(matchesShortcut("mod+f", find, true)).toBe(true);
  expect(matchesShortcut(fullscreen.binding, find, true)).toBe(false);
  expect(matchesShortcut(fullscreen.binding, toggle, true)).toBe(true);
  expect(matchesShortcut("mod+f", toggle, true)).toBe(false);
  expect(matchesShortcut(fullscreen.binding, keyEvent({ ctrlKey: true }), true)).toBe(false);
  expect(matchesShortcut(fullscreen.binding, keyEvent({ key: "F11" }), true)).toBe(false);
  expect(fullscreen.label).toBe("⌃⌘F");
  expect(fullscreen.keys).toBe("⌃+⌘+F");
});

test("modified F11 does not toggle fullscreen on Windows/Linux", () => {
  const { binding } = getFullscreenShortcut(false);
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
    expect(matchesShortcut(binding, keyEvent({ key: "F11", [modifier]: true }), false)).toBe(false);
  }
});

test("shortcut matching preserves primary modifiers and aliases", () => {
  for (const isMac of [true, false]) {
    const primary = isMac ? { metaKey: true } : { ctrlKey: true };
    const save = keyEvent({ key: "S", code: "KeyS", ...primary });
    expect(matchesShortcut("mod+s", save, isMac)).toBe(true);
    expect(matchesShortcut("cmd+s", save, isMac)).toBe(true);
    expect(matchesShortcut("mod+s", { ...save, shiftKey: true }, isMac)).toBe(false);
    expect(matchesShortcut("mod+s", { ...save, altKey: true }, isMac)).toBe(false);
    expect(matchesShortcut("mod+option+s", { ...save, altKey: true }, isMac)).toBe(true);
    expect(matchesShortcut("mod+s", keyEvent({ key: "s" }), isMac)).toBe(false);
  }
  expect(matchesShortcut("ctrl+f", keyEvent({ ctrlKey: true }), true)).toBe(true);
  expect(matchesShortcut("ctrl+f", keyEvent({ ctrlKey: true, metaKey: true }), true)).toBe(false);
  expect(matchesShortcut("escape", keyEvent({ key: "Escape" }), false)).toBe(true);
  expect(matchesShortcut("escape", keyEvent({ key: "Escape", ctrlKey: true }), false)).toBe(false);
});

test("shortcut matching preserves shifted-symbol and keypad fallbacks", () => {
  for (const isMac of [true, false]) {
    const primary = isMac ? { metaKey: true } : { ctrlKey: true };
    const shifted = keyEvent({ key: ">", code: "Period", shiftKey: true, ...primary });
    expect(matchesShortcut("mod+shift+.", shifted, isMac)).toBe(true);
    expect(matchesShortcut("mod+.", shifted, isMac)).toBe(false);
    expect(matchesShortcut("mod+shift+.", { ...shifted, code: "Comma" }, isMac)).toBe(false);
    expect(matchesShortcut("mod+=", keyEvent({ key: "+", code: "NumpadAdd", ...primary }), isMac)).toBe(true);
    expect(matchesShortcut("mod+-", keyEvent({ key: "-", code: "NumpadSubtract", ...primary }), isMac)).toBe(true);
  }
});
