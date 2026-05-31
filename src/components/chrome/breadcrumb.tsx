import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTopClose,
  PanelTopOpen,
} from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import { shortcutLabel, startWindowDrag, useI18n, type Translate } from "@/lib";
import { ThemeButton } from "./theme-button";
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
  onExportPdf?: () => void;
  copyPulse?: boolean;
  titlebarVisible: boolean;
  onToggleTitlebar: () => void;
  readingMode: boolean;
  onToggleReading: () => void;
  vimOn?: boolean;
  onToggleVim?: () => void;
};

const MAX_SEGMENTS = 4;

function pathSegments(path: string): string[] {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= MAX_SEGMENTS) return parts;
  return ["…", ...parts.slice(-MAX_SEGMENTS)];
}

function statusLabel(status: SaveStatus, t: Translate): string {
  switch (status) {
    case "saving":
      return t("breadcrumb.saving");
    case "dirty":
      return t("breadcrumb.unsaved");
    case "saved":
      return t("breadcrumb.saved");
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
  onExportPdf,
  copyPulse = false,
  titlebarVisible,
  onToggleTitlebar,
  readingMode,
  onToggleReading,
  vimOn,
  onToggleVim,
}: BreadcrumbProps) {
  const { t } = useI18n();
  const path = activePath ?? rootPath;
  const segments = path ? pathSegments(path) : [];
  const label = statusLabel(saveStatus, t);

  return (
    <div className="mdv-breadcrumb" data-tauri-drag-region onMouseDown={startWindowDrag}>
      <Button
        data-tooltip={shortcutLabel(sidebarOpen ? t("breadcrumb.hideSidebarShortcut") : t("breadcrumb.showSidebarShortcut"))}
        aria-label={sidebarOpen ? t("breadcrumb.hideSidebar") : t("breadcrumb.showSidebar")}
        onClick={onToggleSidebar}
        icon={
          <Icon
            icon={sidebarOpen ? PanelLeftClose : PanelLeftOpen}
            size={14}
            strokeWidth={1.5}
          />
        }
      />

      <nav className="mdv-breadcrumb__path" aria-label={t("breadcrumb.path")} data-tauri-drag-region>
        {segments.length === 0 ? (
          <span className="mdv-breadcrumb__placeholder">{t("breadcrumb.noFile")}</span>
        ) : (
          segments.map((seg, i) => (
            <span key={`${seg}-${i}`} className="mdv-breadcrumb__seg-row">
              {i > 0 ? (
                <Icon icon={ChevronRight} size={11} strokeWidth={1.5} title="separator" />
              ) : null}
              <span className={`mdv-breadcrumb__seg${i === segments.length - 1 ? " is-leaf" : ""}`}>
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
        {/* view controls: hide titlebar, reading mode, theme */}
        <Button
          data-tooltip={titlebarVisible ? t("title.hideBreadcrumb") : t("title.showBreadcrumb")}
          aria-label={titlebarVisible ? t("title.hideBreadcrumb") : t("title.showBreadcrumb")}
          aria-pressed={!titlebarVisible}
          onClick={onToggleTitlebar}
          icon={
            <Icon
              icon={titlebarVisible ? PanelTopClose : PanelTopOpen}
              size={14}
              strokeWidth={1.5}
            />
          }
        />
        <Button
          data-tooltip={readingMode ? t("title.exitReadingTooltip") : shortcutLabel(t("title.readingModeShortcut"))}
          aria-label={readingMode ? t("title.exitReading") : t("title.readingMode")}
          aria-pressed={readingMode}
          onClick={onToggleReading}
          icon={<Icon icon={readingMode ? BookOpen : BookOpen} size={14} strokeWidth={1.5} />}
        />
        <ThemeButton vimOn={vimOn} onToggleVim={onToggleVim} />

        {/* file actions — border-left matches the status→actions separator */}
        <div className="mdv-breadcrumb__file-actions">
          {onCopyMarkdown ? (
            <button
              type="button"
              className={`mdv-copybtn${copyPulse ? " is-copied" : ""}`}
              data-tooltip={copyPulse ? t("app.copied") : shortcutLabel(t("app.copyMarkdownShortcut"))}
              aria-label={copyPulse ? t("app.copied") : t("app.copyMarkdown")}
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
            data-tooltip={shortcutLabel(t("app.exportPdfShortcut"))}
            aria-label={t("app.exportPdf")}
            onClick={onExportPdf}
            icon={<Icon icon={FileDown} size={13} strokeWidth={1.5} />}
          />
          <Button
            data-tooltip={shortcutLabel(t("app.newFileShortcut"))}
            aria-label={t("app.newFile")}
            onClick={onNewFile}
            icon={<Icon icon={FilePlus2} size={13} strokeWidth={1.5} />}
          />
          <Button
            data-tooltip={shortcutLabel(t("app.openFileShortcut"))}
            aria-label={t("app.openFile")}
            onClick={onOpenFile}
            icon={<Icon icon={FileText} size={13} strokeWidth={1.5} />}
          />
          <Button
            data-tooltip={shortcutLabel(t("app.openFolderShortcut"))}
            aria-label={t("app.openFolder")}
            onClick={onOpenFolder}
            icon={<Icon icon={FolderOpen} size={13} strokeWidth={1.5} />}
          />
        </div>
      </div>
    </div>
  );
}
