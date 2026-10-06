import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, FolderPlus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import { startWindowDrag, useI18n, type FileEntry } from "@/lib";
import emptyTowerUrl from "@/assets/mascot/empty-m.png";
import { type NewEntry } from "./file-tree";
import { SearchResults } from "./sidebar-search";
import { RootFolder } from "./root-folder";
import { Favorites } from "./favorites";

type SidebarProps = {
  open: boolean;
  rootPath: string | null;
  folders: readonly string[];
  activePath: string | null;
  width: number;
  onWidthChange: (next: number) => void;
  onAddFolder: () => void;
  onRefresh?: () => void;
  onCloseFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
  onMove?: (src: string, dstParent: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
  stagedPaths?: readonly string[];
  stagedTokenLabel?: string;
  onToggleStage?: (path: string) => void;
  favorites?: readonly string[];
  onToggleFavorite?: (path: string) => void;
  onReorderFavorites?: (from: number, to: number) => void;
  onCopyContext?: () => void;
  onClearContext?: () => void;
  editingPath?: string | null;
  onSubmitRename?: (src: string, newName: string) => void;
  onCancelEdit?: () => void;
  newEntry?: NewEntry | null;
  onSubmitNew?: (parent: string, kind: "file" | "folder", name: string) => void;
  onCancelNew?: () => void;
  treeVersion?: number;
};

const MIN_WIDTH = 180;
const REFRESH_SPIN_MS = 600;

export function Sidebar({
  open,
  rootPath,
  folders,
  activePath,
  width,
  onWidthChange,
  onAddFolder,
  onRefresh,
  onCloseFolder,
  onSelectFile,
  onMove,
  onContextMenu,
  stagedPaths = [],
  stagedTokenLabel = "0",
  onToggleStage,
  favorites = [],
  onToggleFavorite,
  onReorderFavorites,
  onCopyContext,
  onClearContext,
  editingPath,
  onSubmitRename,
  onCancelEdit,
  newEntry,
  onSubmitNew,
  onCancelNew,
  treeVersion = 0,
}: SidebarProps) {
  const { t } = useI18n();
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const next = Math.max(MIN_WIDTH, startWidthRef.current + delta);
      onWidthChange(next);
    },
    [onWidthChange],
  );

  const stopResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [rootDrop, setRootDrop] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // reset search when the folder changes
  useEffect(() => {
    setQuery("");
    setSearchOpen(false);
  }, [rootPath]);

  // autofocus when opening; Escape closes (but defer to any open modal overlay)
  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // if any modal overlay is open, let it consume the Escape first
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      setSearchOpen(false);
      setQuery("");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, []);

  // brief spin so a refresh reads as handled even when nothing changed on disk
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);
  const handleRefresh = useCallback(() => {
    onRefresh?.();
    setRefreshing(true);
    if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      setRefreshing(false);
    }, REFRESH_SPIN_MS);
  }, [onRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return (
    <aside
      className={`mdv-sidebar${open ? " is-open" : ""}`}
      style={{ width: open ? `${width}px` : "0px" }}
      aria-hidden={!open}
    >
      <div className="mdv-sidebar__inner" style={{ width: `${width}px` }}>
        <header className="mdv-sidebar__header" data-tauri-drag-region onMouseDown={startWindowDrag}>
          <span className="mdv-sidebar__title">
            {t("sidebar.explorer")}
          </span>
          <div className="mdv-sidebar__header-actions">
            {folders.length > 0 ? (
              <Button
                data-tooltip={searchOpen ? t("sidebar.closeSearchShortcut") : t("sidebar.searchFolder")}
                aria-label={searchOpen ? t("sidebar.closeSearch") : t("sidebar.searchFolder")}
                aria-pressed={searchOpen}
                onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                icon={<Icon icon={Search} size={12} strokeWidth={1.5} />}
              />
            ) : null}
            {folders.length > 0 && onRefresh ? (
              <Button
                data-tooltip={t("sidebar.refresh")}
                aria-label={t("sidebar.refresh")}
                onClick={handleRefresh}
                icon={
                  <span className={`mdv-sidebar__refresh-icon${refreshing ? " is-spinning" : ""}`}>
                    <Icon icon={RefreshCw} size={12} strokeWidth={1.5} />
                  </span>
                }
              />
            ) : null}
            <Button
              data-tooltip={t("sidebar.addFolder")}
              aria-label={t("sidebar.addFolder")}
              onClick={onAddFolder}
              icon={<Icon icon={FolderPlus} size={13} strokeWidth={1.5} />}
            />
          </div>
        </header>
        {rootPath ? (
          <div
            className={`mdv-sidebar__search-row${searchOpen ? " is-open" : ""}`}
            aria-hidden={!searchOpen}
          >
            <span className="mdv-sidebar__search-icon" aria-hidden>
              <Icon icon={Search} size={12} strokeWidth={1.5} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="mdv-sidebar__search-input"
              placeholder={t("sidebar.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              tabIndex={searchOpen ? 0 : -1}
            />
            <button
              type="button"
              className="mdv-sidebar__search-close"
              aria-label={t("sidebar.closeSearch")}
              onClick={closeSearch}
              tabIndex={searchOpen ? 0 : -1}
            >
              <Icon icon={X} size={11} strokeWidth={2} />
            </button>
          </div>
        ) : null}
        <div
          className={`mdv-sidebar__body${rootDrop ? " is-root-drop" : ""}`}
          onDragOver={(e) => {
            if (!onMove || !rootPath) return;
            // skip if cursor is over a folder row — that has its own drop handler
            const target = e.target as HTMLElement;
            if (target.closest(".mdv-tree__row--folder")) {
              if (rootDrop) setRootDrop(false);
              return;
            }
            if (!e.dataTransfer.types.includes("application/x-marka-path")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!rootDrop) setRootDrop(true);
          }}
          onDragLeave={(e) => {
            // only clear when leaving the body element entirely (not bubbling)
            if (e.currentTarget === e.target) setRootDrop(false);
          }}
          onDrop={(e) => {
            if (!onMove || !rootPath) return;
            // let folder rows handle their own drops
            const target = e.target as HTMLElement;
            if (target.closest(".mdv-tree__row--folder")) return;
            const src = e.dataTransfer.getData("application/x-marka-path");
            if (!src) return;
            e.preventDefault();
            setRootDrop(false);
            // no-op if already at root
            const sep = src.includes("\\") ? "\\" : "/";
            const srcParent = src.slice(0, src.lastIndexOf(sep));
            if (srcParent === rootPath) return;
            onMove(src, rootPath);
          }}
        >
          {folders.length > 0 ? (
            query.trim().length > 0 && rootPath ? (
              <SearchResults
                rootPath={rootPath}
                query={query}
                activePath={activePath}
                treeVersion={treeVersion}
                onSelect={onSelectFile}
              />
            ) : (
              <>
                <Favorites
                  favorites={favorites}
                  activePath={activePath}
                  title={t("sidebar.favorites")}
                  emptyLabel={t("sidebar.noFavorites")}
                  removeLabel={t("sidebar.unfavorite")}
                  onSelect={onSelectFile}
                  onToggleFavorite={(p) => onToggleFavorite?.(p)}
                  onReorder={(from, to) => onReorderFavorites?.(from, to)}
                  onContextMenu={onContextMenu}
                />
                {folders.map((folder) => (
                  <RootFolder
                    key={folder}
                    path={folder}
                    activePath={activePath}
                    onSelect={onSelectFile}
                    onMove={onMove}
                    onContextMenu={onContextMenu}
                    onClose={onCloseFolder}
                    closeLabel={t("sidebar.closeFolder")}
                    stagedPaths={stagedPaths}
                    onToggleStage={onToggleStage}
                    favoritePaths={favorites}
                    onToggleFavorite={onToggleFavorite}
                    editingPath={editingPath}
                    onSubmitRename={onSubmitRename}
                    onCancelEdit={onCancelEdit}
                    newEntry={newEntry}
                    onSubmitNew={onSubmitNew}
                    onCancelNew={onCancelNew}
                    treeVersion={treeVersion}
                  />
                ))}
              </>
            )
          ) : (
            <>
              <Favorites
                favorites={favorites}
                activePath={activePath}
                title={t("sidebar.favorites")}
                emptyLabel={t("sidebar.noFavorites")}
                removeLabel={t("sidebar.unfavorite")}
                onSelect={onSelectFile}
                onToggleFavorite={(p) => onToggleFavorite?.(p)}
                onReorder={(from, to) => onReorderFavorites?.(from, to)}
                onContextMenu={onContextMenu}
              />
              {favorites.length === 0 ? (
                <button type="button" className="mdv-sidebar__empty" onClick={onAddFolder}>
                  <img
                    src={emptyTowerUrl}
                    alt=""
                    aria-hidden
                    width={72}
                    height={68}
                    draggable={false}
                    className="mdv-sidebar__empty-art"
                  />
                  <span>{t("sidebar.addFolder")}</span>
                  <span className="mdv-sidebar__hint">{t("sidebar.browseNotes")}</span>
                </button>
              ) : null}
            </>
          )}
        </div>
        {rootPath && stagedPaths.length > 0 ? (
          <footer className="mdv-context-tray">
            <div className="mdv-context-tray__meta">
              <span className="mdv-context-tray__label">{t("sidebar.context")}</span>
              <span className="mdv-context-tray__count">
                {stagedPaths.length === 1
                  ? t("app.fileSingular", { count: 1 })
                  : t("app.filePlural", { count: stagedPaths.length })}
              </span>
              <span className="mdv-context-tray__tokens">{t("sidebar.tokens", { tokens: stagedTokenLabel })}</span>
            </div>
            <div className="mdv-context-tray__actions">
              <Button
                data-tooltip={t("sidebar.copyContext")}
                aria-label={t("sidebar.copyContext")}
                onClick={onCopyContext}
                icon={<Icon icon={Copy} size={12} strokeWidth={1.6} />}
              />
              <Button
                data-tooltip={t("sidebar.clearContext")}
                aria-label={t("sidebar.clearContext")}
                onClick={onClearContext}
                icon={<Icon icon={Trash2} size={12} strokeWidth={1.6} />}
              />
            </div>
          </footer>
        ) : null}
      </div>

      <div
        className="mdv-sidebar__resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={stopResize}
        onPointerCancel={stopResize}
        role="separator"
        aria-orientation="vertical"
        aria-label={t("sidebar.resize")}
      />
    </aside>
  );
}
