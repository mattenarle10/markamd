import { Check, ChevronRight, Copy, FilePlus2, FileText, FolderOpen, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import { shortcutLabel, startWindowDrag } from "@/lib";
import exciteUrl from "@/assets/mascot/excite.png";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved";

type BreadcrumbProps = {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  rootPath: string | null;
  activePath: string | null;
  saveStatus: SaveStatus;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onCopyMarkdown?: () => void;
  copyPulse?: boolean;
};

const MAX_SEGMENTS = 4;

function pathSegments(path: string): string[] {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= MAX_SEGMENTS) return parts;
  return ["…", ...parts.slice(-MAX_SEGMENTS)];
}

function statusLabel(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "saving…";
    case "dirty":
      return "unsaved";
    case "saved":
      return "saved";
    default:
      return "";
  }
}

export function Breadcrumb({
  sidebarOpen,
  onToggleSidebar,
  rootPath,
  activePath,
  saveStatus,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onCopyMarkdown,
  copyPulse = false,
}: BreadcrumbProps) {
  const path = activePath ?? rootPath;
  const segments = path ? pathSegments(path) : [];
  const label = statusLabel(saveStatus);

  return (
    <div className="mdv-breadcrumb" data-tauri-drag-region onMouseDown={startWindowDrag}>
      <Button
        data-tooltip={shortcutLabel(sidebarOpen ? "hide sidebar (⌘B)" : "show sidebar (⌘B)")}
        aria-label={sidebarOpen ? "hide sidebar" : "show sidebar"}
        onClick={onToggleSidebar}
        icon={
          <Icon
            icon={sidebarOpen ? PanelLeftClose : PanelLeftOpen}
            size={14}
            strokeWidth={1.5}
          />
        }
      />

      <nav className="mdv-breadcrumb__path" aria-label="path" data-tauri-drag-region>
        {segments.length === 0 ? (
          <span className="mdv-breadcrumb__placeholder">no file open</span>
        ) : (
          segments.map((seg, i) => (
            <span key={`${seg}-${i}`} className="mdv-breadcrumb__seg-row">
              {i > 0 ? (
                <Icon
                  icon={ChevronRight}
                  size={11}
                  strokeWidth={1.5}
                  title="separator"
                />
              ) : null}
              <span
                className={`mdv-breadcrumb__seg${i === segments.length - 1 ? " is-leaf" : ""}`}
              >
                {seg}
              </span>
            </span>
          ))
        )}
      </nav>

      <div className="mdv-breadcrumb__status" data-status={saveStatus}>
        {saveStatus !== "idle" ? (
          <>
            {saveStatus === "saved" ? (
              <img
                src={exciteUrl}
                alt=""
                aria-hidden
                width={16}
                height={16}
                draggable={false}
                className="mdv-breadcrumb__excite"
              />
            ) : (
              <span className="mdv-breadcrumb__dot" aria-hidden />
            )}
            <span className="mdv-breadcrumb__status-label">{label}</span>
          </>
        ) : null}
      </div>

      <div className="mdv-breadcrumb__actions" data-tauri-drag-region>
        {onCopyMarkdown ? (
          <button
            type="button"
            className={`mdv-copybtn${copyPulse ? " is-copied" : ""}`}
            data-tooltip={copyPulse ? "copied!" : shortcutLabel("copy markdown (⌘⇧C)")}
            aria-label={copyPulse ? "copied" : "copy markdown"}
            onClick={onCopyMarkdown}
          >
            <span className="mdv-copybtn__icon mdv-copybtn__icon--copy" aria-hidden>
              <Icon icon={Copy} size={12} strokeWidth={1.5} />
            </span>
            <span className="mdv-copybtn__icon mdv-copybtn__icon--check" aria-hidden>
              <Icon icon={Check} size={13} strokeWidth={2} />
            </span>
          </button>
        ) : null}
        <Button
          data-tooltip={shortcutLabel("new file (⌘N)")}
          aria-label="new file"
          onClick={onNewFile}
          icon={<Icon icon={FilePlus2} size={13} strokeWidth={1.5} />}
        />
        <Button
          data-tooltip={shortcutLabel("open file (⌘O)")}
          aria-label="open file"
          onClick={onOpenFile}
          icon={<Icon icon={FileText} size={13} strokeWidth={1.5} />}
        />
        <Button
          data-tooltip={shortcutLabel("open folder (⌘⇧O)")}
          aria-label="open folder"
          onClick={onOpenFolder}
          icon={<Icon icon={FolderOpen} size={13} strokeWidth={1.5} />}
        />
      </div>
    </div>
  );
}
