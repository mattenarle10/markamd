import { useCallback, useEffect, useRef, useState } from "react";
import {
  basename,
  createFolder,
  createMarkdownFile,
  dirname,
  FS_CONFLICT,
  joinPath,
  listFolder,
  moveEntry,
  readMarkdown,
  removeEntry,
  renameEntry,
} from "@/lib";
import type { NewEntry } from "@/components/files/file-tree";
import type { LoadError } from "./use-file-session";

type UndoOp =
  | { kind: "move"; from: string; to: string }
  | { kind: "rename"; from: string; to: string }
  | { kind: "create-folder"; path: string }
  | { kind: "create-file"; path: string };

type UseFileOpsArgs = {
  activePath: string | null;
  setActivePath: (v: string | null | ((p: string | null) => string | null)) => void;
  loadFile: (path: string) => Promise<void | boolean>;
  startNewBuffer: (initial?: string) => void;
  onError: (err: LoadError) => void;
};

type UseFileOpsResult = {
  /** Bump this counter to force the sidebar tree to re-walk after fs mutations. */
  treeVersion: number;
  bumpTree: () => void;
  editingPath: string | null;
  setEditingPath: (v: string | null) => void;
  newEntry: NewEntry | null;
  setNewEntry: (v: NewEntry | null) => void;
  handleMove: (src: string, dstParent: string) => Promise<void>;
  handleSubmitRename: (src: string, newName: string) => Promise<void>;
  handleSubmitNew: (parent: string, kind: "file" | "folder", name: string) => Promise<void>;
  handleUndoFileOp: () => Promise<void>;
};

export function useFileOps({
  activePath,
  setActivePath,
  loadFile,
  startNewBuffer,
  onError,
}: UseFileOpsArgs): UseFileOpsResult {
  const [treeVersion, setTreeVersion] = useState(0);
  const bumpTree = useCallback(() => setTreeVersion((v) => v + 1), []);

  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<NewEntry | null>(null);

  const undoStackRef = useRef<UndoOp[]>([]);
  const pushUndo = useCallback((op: UndoOp) => {
    const stack = undoStackRef.current;
    stack.push(op);
    if (stack.length > 20) stack.shift();
  }, []);

  const handleMove = useCallback(
    async (src: string, dstParent: string) => {
      try {
        const newPath = await moveEntry(src, dstParent);
        pushUndo({ kind: "move", from: src, to: newPath });
        bumpTree();
        if (activePath === src) setActivePath(newPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          const name = basename(src);
          const target = joinPath(dstParent, name);
          onError({
            message: `${name} already exists at the destination`,
            path: target,
          });
        } else {
          console.error("marka.md: move failed", err);
          onError({ message: `could not move ${basename(src)} — ${msg}` });
        }
      }
    },
    [activePath, bumpTree, pushUndo, setActivePath, onError],
  );

  const handleSubmitRename = useCallback(
    async (src: string, newName: string) => {
      setEditingPath(null);
      try {
        const newPath = await renameEntry(src, newName);
        pushUndo({ kind: "rename", from: src, to: newPath });
        bumpTree();
        if (activePath === src) setActivePath(newPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          onError({ message: `${newName} already exists in this folder` });
        } else {
          console.error("marka.md: rename failed", err);
          onError({ message: `could not rename — ${msg}` });
        }
      }
    },
    [activePath, bumpTree, pushUndo, setActivePath, onError],
  );

  const handleSubmitNew = useCallback(
    async (parent: string, kind: "file" | "folder", name: string) => {
      setNewEntry(null);
      try {
        if (kind === "folder") {
          const created = await createFolder(parent, name);
          pushUndo({ kind: "create-folder", path: created });
        } else {
          const created = await createMarkdownFile(parent, name);
          pushUndo({ kind: "create-file", path: created });
          await loadFile(created);
        }
        bumpTree();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes(FS_CONFLICT)) {
          onError({ message: `${name} already exists in this folder` });
        } else {
          console.error("marka.md: create failed", err);
          onError({ message: `could not create — ${msg}` });
        }
      }
    },
    [bumpTree, pushUndo, loadFile, onError],
  );

  const handleUndoFileOp = useCallback(async () => {
    const op = undoStackRef.current.pop();
    if (!op) return;
    try {
      if (op.kind === "move") {
        await moveEntry(op.to, dirname(op.from));
        if (activePath === op.to) setActivePath(op.from);
        bumpTree();
        return;
      }
      if (op.kind === "rename") {
        await renameEntry(op.to, basename(op.from));
        if (activePath === op.to) setActivePath(op.from);
        bumpTree();
        return;
      }
      if (op.kind === "create-folder") {
        const entries = await listFolder(op.path);
        if (entries.length > 0) {
          onError({ message: `can't undo — ${basename(op.path)} has content` });
          return;
        }
        await removeEntry(op.path, true);
        bumpTree();
        return;
      }
      if (op.kind === "create-file") {
        const content = await readMarkdown(op.path);
        if (content.length > 0) {
          onError({ message: `can't undo — ${basename(op.path)} has been edited` });
          return;
        }
        await removeEntry(op.path, false);
        if (activePath === op.path) {
          startNewBuffer();
        }
        bumpTree();
        return;
      }
    } catch (err) {
      console.error("marka.md: undo failed", err);
      onError({ message: `could not undo — ${err instanceof Error ? err.message : err}` });
    }
  }, [activePath, bumpTree, setActivePath, startNewBuffer, onError]);

  // ⌥Z produces Ω on macOS — match e.code, not e.key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.altKey && !e.shiftKey && e.code === "KeyZ") {
        e.preventDefault();
        void handleUndoFileOp();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleUndoFileOp]);

  return {
    treeVersion,
    bumpTree,
    editingPath,
    setEditingPath,
    newEntry,
    setNewEntry,
    handleMove,
    handleSubmitRename,
    handleSubmitNew,
    handleUndoFileOp,
  };
}
