import { STORAGE_KEYS } from "./storage";

export type Draft = {
  id: string;
  path: string | null;
  source: string;
  savedContent: string;
};

export type DraftSession = {
  version: 1;
  activeTabId: string;
  drafts: Draft[];
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Save only unsaved work; clean files should continue to load from disk. */
export function captureDraftSession(tabs: readonly Draft[], activeTabId: string): DraftSession | null {
  const drafts = tabs
    .filter((tab) => tab.source !== tab.savedContent)
    .map(({ id, path, source, savedContent }) => ({ id, path, source, savedContent }));
  if (drafts.length === 0) return null;
  return {
    version: 1,
    activeTabId: drafts.some((tab) => tab.id === activeTabId) ? activeTabId : drafts[0].id,
    drafts,
  };
}

export function readDraftSession(storage: DraftStorage): DraftSession | null {
  const raw = storage.getItem(STORAGE_KEYS.drafts);
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
    || !("activeTabId" in value) || typeof value.activeTabId !== "string"
    || !("drafts" in value) || !Array.isArray(value.drafts)) {
    throw new Error("Invalid draft session");
  }
  const ids = new Set<string>();
  const paths = new Set<string>();
  const drafts: Draft[] = [];
  for (const draft of value.drafts) {
    if (!draft || typeof draft !== "object"
      || typeof draft.id !== "string" || !draft.id || ids.has(draft.id)
      || (draft.path !== null && (typeof draft.path !== "string" || !draft.path || paths.has(draft.path)))
      || typeof draft.source !== "string" || typeof draft.savedContent !== "string") {
      throw new Error("Invalid draft session");
    }
    ids.add(draft.id);
    if (draft.path !== null) paths.add(draft.path);
    drafts.push({ id: draft.id, path: draft.path, source: draft.source, savedContent: draft.savedContent });
  }
  return captureDraftSession(drafts, value.activeTabId);
}

/** setItem is atomic: a quota/storage error leaves the previous backup intact. */
export function writeDraftSession(storage: DraftStorage, session: DraftSession | null): void {
  if (session === null) storage.removeItem(STORAGE_KEYS.drafts);
  else storage.setItem(STORAGE_KEYS.drafts, JSON.stringify(session));
}

export function reconcileRecoveredDraft(draft: Draft, diskContent: string | null) {
  return {
    missing: diskContent === null,
    savedContent: diskContent === draft.source ? diskContent : draft.savedContent,
    conflict: diskContent !== null && diskContent !== draft.source && diskContent !== draft.savedContent
      ? diskContent
      : null,
  };
}
