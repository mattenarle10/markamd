import { useEffect, useState } from "react";
import { listFolder, type FileEntry } from "@/lib";
import sadUrl from "@/assets/mascot/sad.png";
import { EditableRow } from "./editable-row";
import { FileNode, FolderNode } from "./folder-node";

export type NewEntry = { parent: string; kind: "file" | "folder" };

type FileTreeProps = {
  rootPath: string;
  activePath: string | null;
  onSelect: (path: string) => void;
  onMove?: (src: string, dstParent: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
  stagedPaths?: readonly string[];
  onToggleStage?: (path: string) => void;
  favoritePaths?: readonly string[];
  onToggleFavorite?: (path: string) => void;
  editingPath?: string | null;
  onSubmitRename?: (src: string, newName: string) => void;
  onCancelEdit?: () => void;
  newEntry?: NewEntry | null;
  onSubmitNew?: (parent: string, kind: "file" | "folder", name: string) => void;
  onCancelNew?: () => void;
  treeVersion?: number;
  depth?: number;
};

export function FileTree({
  rootPath,
  activePath,
  onSelect,
  onMove,
  onContextMenu,
  stagedPaths = [],
  onToggleStage,
  favoritePaths = [],
  onToggleFavorite,
  editingPath,
  onSubmitRename,
  onCancelEdit,
  newEntry,
  onSubmitNew,
  onCancelNew,
  treeVersion = 0,
  depth = 0,
}: FileTreeProps) {
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listFolder(rootPath)
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("marka.md: listFolder failed", e);
          setError(String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath, treeVersion]);

  if (error) {
    return (
      <div className="mdv-tree__error">
        <img src={sadUrl} alt="" aria-hidden width={56} height={56} className="mdv-tree__error-art" />
        <span>cannot read folder</span>
      </div>
    );
  }
  if (!entries) {
    return <div className="mdv-tree__loading">loading…</div>;
  }
  if (entries.length === 0 && depth <= 1 && !(newEntry && newEntry.parent === rootPath)) {
    return <div className="mdv-tree__empty">empty folder</div>;
  }

  const showNewEntryHere = newEntry && newEntry.parent === rootPath;

  return (
    <ul
      className="mdv-tree"
      role={depth === 0 ? "tree" : "group"}
      style={depth > 0 ? ({ "--tree-depth": depth } as React.CSSProperties) : undefined}
    >
      {showNewEntryHere && newEntry && onSubmitNew && onCancelNew ? (
        <EditableRow
          key="__new__"
          depth={depth}
          kind={newEntry.kind}
          initialValue=""
          onSubmit={(name) => onSubmitNew(newEntry.parent, newEntry.kind, name)}
          onCancel={onCancelNew}
        />
      ) : null}
      {entries.map((entry) => {
        if (editingPath === entry.path && onSubmitRename && onCancelEdit) {
          return (
            <EditableRow
              key={entry.path}
              depth={depth}
              kind={entry.isDir ? "folder" : "file"}
              initialValue={entry.name}
              onSubmit={(name) => onSubmitRename(entry.path, name)}
              onCancel={onCancelEdit}
            />
          );
        }
        if (entry.isDir) {
          return (
            <FolderNode
              key={entry.path}
              entry={entry}
              activePath={activePath}
              onSelect={onSelect}
              onMove={onMove}
              onContextMenu={onContextMenu}
              stagedPaths={stagedPaths}
              onToggleStage={onToggleStage}
              favoritePaths={favoritePaths}
              onToggleFavorite={onToggleFavorite}
              editingPath={editingPath}
              onSubmitRename={onSubmitRename}
              onCancelEdit={onCancelEdit}
              newEntry={newEntry}
              onSubmitNew={onSubmitNew}
              onCancelNew={onCancelNew}
              treeVersion={treeVersion}
              depth={depth}
            />
          );
        }
        return (
          <FileNode
            key={entry.path}
            entry={entry}
            active={activePath === entry.path}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            staged={stagedPaths.includes(entry.path)}
            onToggleStage={onToggleStage}
            favorite={favoritePaths.includes(entry.path)}
            onToggleFavorite={onToggleFavorite}
            depth={depth}
          />
        );
      })}
    </ul>
  );
}
