import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, FilePlus2, FileText, Folder, FolderOpen, Star, Table2 } from "lucide-react";
import { Icon } from "@/components/primitives";
import { isCsvPath, type FileEntry } from "@/lib";
import { FileTree, type NewEntry } from "./file-tree";

export const DRAG_MIME = "application/x-marka-path";

function isDescendantPath(child: string, parent: string): boolean {
  if (child === parent) return true;
  const sep = parent.includes("\\") ? "\\" : "/";
  const prefix = parent.endsWith(sep) ? parent : parent + sep;
  return child.startsWith(prefix);
}

type FolderNodeProps = {
  entry: FileEntry;
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
  treeVersion: number;
  depth: number;
};

export function FolderNode({
  entry,
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
  treeVersion,
  depth,
}: FolderNodeProps) {
  const [open, setOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // auto-open when a new entry is being created inside us
  useEffect(() => {
    if (newEntry && newEntry.parent === entry.path && !open) setOpen(true);
  }, [newEntry, entry.path, open]);

  const onDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(DRAG_MIME, entry.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    if (!onMove) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDropTarget) setIsDropTarget(true);
  };

  const onDragLeave = () => {
    if (isDropTarget) setIsDropTarget(false);
  };

  const onDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDropTarget(false);
    const src = e.dataTransfer.getData(DRAG_MIME);
    if (!src || !onMove) return;
    if (isDescendantPath(entry.path, src)) return; // drop into self or descendant
    onMove(src, entry.path);
  };

  const onCtx = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, entry);
    }
  };

  return (
    <li className="mdv-tree__item" role="treeitem" aria-expanded={open}>
      <button
        type="button"
        draggable
        className={`mdv-tree__row mdv-tree__row--folder${isDropTarget ? " is-drop-target" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={toggle}
        onContextMenu={onCtx}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        title={entry.name}
      >
        <span className={`mdv-tree__chevron${open ? " is-open" : ""}`}>
          <Icon icon={ChevronRight} size={12} strokeWidth={2} />
        </span>
        <span className="mdv-tree__icon">
          <Icon icon={open ? FolderOpen : Folder} size={13} strokeWidth={1.5} />
        </span>
        <span className="mdv-tree__name">{entry.name}</span>
      </button>
      {open ? (
        <FileTree
          rootPath={entry.path}
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
          depth={depth + 1}
        />
      ) : null}
    </li>
  );
}

type FileNodeProps = {
  entry: FileEntry;
  active: boolean;
  onSelect: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
  staged?: boolean;
  onToggleStage?: (path: string) => void;
  favorite?: boolean;
  onToggleFavorite?: (path: string) => void;
  depth: number;
};

export function FileNode({
  entry,
  active,
  onSelect,
  onContextMenu,
  staged = false,
  onToggleStage,
  favorite = false,
  onToggleFavorite,
  depth,
}: FileNodeProps) {
  const onDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(DRAG_MIME, entry.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const onCtx = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, entry);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if ((e.metaKey || e.ctrlKey) && onToggleStage) {
      e.preventDefault();
      onToggleStage(entry.path);
      return;
    }
    onSelect(entry.path);
  };

  return (
    <li className="mdv-tree__item" role="treeitem" aria-selected={active}>
      <button
        type="button"
        draggable
        className={`mdv-tree__row mdv-tree__row--file${active ? " is-active" : ""}${staged ? " is-staged" : ""}${onToggleFavorite ? " has-fav" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12 + 4}px` }}
        onClick={handleClick}
        onContextMenu={onCtx}
        onDragStart={onDragStart}
        data-mdv-tree-path={entry.path}
        title={entry.path}
      >
        <span className="mdv-tree__icon">
          <Icon icon={isCsvPath(entry.name) ? Table2 : FileText} size={13} strokeWidth={1.5} />
        </span>
        <span className="mdv-tree__name">{entry.name}</span>
      </button>
      {onToggleStage ? (
        <button
          type="button"
          className={`mdv-tree__stage${staged ? " is-staged" : ""}${onToggleFavorite ? " has-fav" : ""}`}
          data-tooltip={staged ? "remove from context" : "stage for context"}
          aria-label={staged ? `remove ${entry.name} from context` : `stage ${entry.name} for context`}
          aria-pressed={staged}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStage(entry.path);
          }}
        >
          <Icon icon={staged ? Check : FilePlus2} size={11} strokeWidth={1.8} />
        </button>
      ) : null}
      {onToggleFavorite ? (
        <button
          type="button"
          className={`mdv-tree__fav${favorite ? " is-fav" : ""}`}
          data-tooltip={favorite ? "remove from favorites" : "add to favorites"}
          aria-label={favorite ? `remove ${entry.name} from favorites` : `add ${entry.name} to favorites`}
          aria-pressed={favorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(entry.path);
          }}
        >
          <Icon icon={Star} size={11} strokeWidth={1.8} />
        </button>
      ) : null}
    </li>
  );
}
