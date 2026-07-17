import { expect, test } from "bun:test";
import { directoryFingerprint, isVisibleTreeEntryName, relativePath } from "../src/lib/files";

test("shows common dot-prefixed tool folders", () => {
  for (const name of [".agent", ".claude", ".codex", ".cursor", ".github", ".vscode"]) {
    expect(isVisibleTreeEntryName(name)).toBe(true);
  }
});

test("keeps noisy hidden entries filtered", () => {
  for (const name of [".git", ".DS_Store", ".cache", ".env"]) {
    expect(isVisibleTreeEntryName(name)).toBe(false);
  }
});

test("shows regular entries", () => {
  expect(isVisibleTreeEntryName("notes")).toBe(true);
  expect(isVisibleTreeEntryName("readme.md")).toBe(true);
});

test("formats relative paths only inside the selected root", () => {
  expect(relativePath("/notes/project/brief.md", "/notes/project")).toBe("brief.md");
  expect(relativePath("/notes/project-extra/brief.md", "/notes/project")).toBe("brief.md");
  expect(relativePath("C:\\notes\\project\\brief.md", "C:\\notes\\project")).toBe("brief.md");
});

test("changes directory fingerprints when entries are added or removed", () => {
  const before = [{ name: "notes", path: "/docs/notes", isDir: true }];
  const after = [
    ...before,
    { name: "readme.md", path: "/docs/readme.md", isDir: false },
  ];

  expect(directoryFingerprint(before)).not.toBe(directoryFingerprint(after));
  expect(directoryFingerprint(after)).toBe(directoryFingerprint(after));
});

test("directory fingerprints include file versus folder type", () => {
  const file = [{ name: "notes", path: "/docs/notes", isDir: false }];
  const folder = [{ name: "notes", path: "/docs/notes", isDir: true }];

  expect(directoryFingerprint(file)).not.toBe(directoryFingerprint(folder));
});
