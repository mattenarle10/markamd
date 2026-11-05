import { expect, test } from "bun:test";
import {
  captureDraftSession,
  readDraftSession,
  reconcileRecoveredDraft,
  writeDraftSession,
  type Draft,
} from "../src/lib/drafts";
import { STORAGE_KEYS } from "../src/lib/storage";

class MemoryStorage {
  readonly values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("Quota exceeded");
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

function draft(overrides: Partial<Draft> = {}): Draft {
  return { id: "tab-1", path: "/notes.md", source: "unsaved notes", savedContent: "saved notes", ...overrides };
}

test("recovers multiple dirty files and untitled tabs with their active selection", () => {
  const storage = new MemoryStorage();
  const tabs = [draft(), draft({ id: "tab-2", path: null, source: "untitled draft", savedContent: "" })];
  const session = captureDraftSession(tabs, "tab-2");
  writeDraftSession(storage, session);
  expect(readDraftSession(storage)).toEqual({ version: 1, activeTabId: "tab-2", drafts: tabs });
});

test("does not back up clean files, unchanged welcome content, or empty new tabs", () => {
  const tabs = [
    draft({ source: "saved notes" }),
    draft({ id: "welcome", path: null, source: "welcome", savedContent: "welcome" }),
    draft({ id: "blank", path: null, source: "", savedContent: "" }),
  ];
  expect(captureDraftSession(tabs, "blank")).toBeNull();
});

test("preserves an unsaved deletion of the entire file and Unicode text", () => {
  const storage = new MemoryStorage();
  const tabs = [draft({ source: "" }), draft({ id: "unicode", path: null, source: "你好 👋", savedContent: "" })];
  writeDraftSession(storage, captureDraftSession(tabs, "tab-1"));
  expect(readDraftSession(storage)?.drafts).toEqual(tabs);
});

test("falls back to a recovered tab when the active clean tab has no draft", () => {
  expect(captureDraftSession([draft()], "clean-tab")?.activeTabId).toBe("tab-1");
});

test("saving one draft or explicitly closing another removes their backups", () => {
  const storage = new MemoryStorage();
  const first = draft();
  const second = draft({ id: "tab-2", path: "/second.md" });
  writeDraftSession(storage, captureDraftSession([first, second], first.id));
  writeDraftSession(storage, captureDraftSession([{ ...first, savedContent: first.source }, second], second.id));
  expect(readDraftSession(storage)?.drafts).toEqual([second]);
  writeDraftSession(storage, captureDraftSession([], second.id));
  expect(readDraftSession(storage)).toBeNull();
  expect(storage.getItem(STORAGE_KEYS.drafts)).toBeNull();
});

test("keeps newer edits recoverable after an earlier version finishes saving", () => {
  const storage = new MemoryStorage();
  const tab = draft({ source: "typed during save", savedContent: "version sent to disk" });
  writeDraftSession(storage, captureDraftSession([tab], tab.id));
  expect(readDraftSession(storage)?.drafts[0].source).toBe("typed during save");
});

test("rejects corrupt or unknown backups without changing their stored bytes", () => {
  for (const raw of ["broken JSON", "null", '{"version":2,"drafts":[]}', '{"version":1,"activeTabId":"a","drafts":[{}]}']) {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.drafts, raw);
    expect(() => readDraftSession(storage)).toThrow();
    expect(storage.getItem(STORAGE_KEYS.drafts)).toBe(raw);
  }
});

test("rejects duplicate tab IDs or duplicate file paths", () => {
  for (const tabs of [[draft(), draft({ path: "/other.md" })], [draft(), draft({ id: "other" })]]) {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.drafts, JSON.stringify({ version: 1, activeTabId: "tab-1", drafts: tabs }));
    expect(() => readDraftSession(storage)).toThrow();
  }
});

test("a failed backup write preserves the previous recoverable version", () => {
  const storage = new MemoryStorage();
  const previous = captureDraftSession([draft()], "tab-1");
  writeDraftSession(storage, previous);
  storage.failWrites = true;
  expect(() => writeDraftSession(storage, captureDraftSession([draft({ source: "new edits" })], "tab-1"))).toThrow();
  expect(readDraftSession(storage)).toEqual(previous);
});

test("keeps the recovered draft dirty when its disk baseline is unchanged", () => {
  expect(reconcileRecoveredDraft(draft(), "saved notes")).toEqual({
    missing: false, savedContent: "saved notes", conflict: null,
  });
});

test("recognizes a completed save even if shutdown left a stale draft backup", () => {
  expect(reconcileRecoveredDraft(draft(), "unsaved notes")).toEqual({
    missing: false, savedContent: "unsaved notes", conflict: null,
  });
});

test("retains both versions if the file changed outside the app during shutdown", () => {
  expect(reconcileRecoveredDraft(draft(), "external edits")).toEqual({
    missing: false, savedContent: "saved notes", conflict: "external edits",
  });
});

test("keeps recovered text available when its original file was deleted", () => {
  expect(reconcileRecoveredDraft(draft(), null)).toEqual({
    missing: true, savedContent: "saved notes", conflict: null,
  });
});
