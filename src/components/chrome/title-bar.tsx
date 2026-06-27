import { Check, Copy, FileDown, Minimize2 } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import {
  shortcutLabel,
  startWindowDrag,
  useI18n,
  type ProseFontFamily,
  type ReadingFontSize,
  type ReadingWidth,
  type WritingDisplay,
  type WritingFontSize,
  type WritingLineHeight,
} from "@/lib";
import { ThemeButton } from "./theme-button";

type TitleBarProps = {
  fileName?: string;
  filePath?: string | null;
  dirty?: boolean;
  readingMode?: boolean;
  onToggleReading?: () => void;
  onCopyMarkdown?: () => void;
  copyPulse?: boolean;
  onExportPdf?: () => void;
  vimOn?: boolean;
  onToggleVim?: () => void;
  writingDisplay: WritingDisplay;
  onWritingFontSizeChange: (value: WritingFontSize) => void;
  onWritingLineHeightChange: (value: WritingLineHeight) => void;
  onReadingFontSizeChange: (value: ReadingFontSize) => void;
  onReadingWidthChange: (value: ReadingWidth) => void;
  onProseFontFamilyChange: (value: ProseFontFamily) => void;
  onResetWritingDisplay: () => void;
};

export function TitleBar({
  fileName,
  filePath,
  dirty = false,
  readingMode = false,
  onToggleReading,
  onCopyMarkdown,
  copyPulse = false,
  onExportPdf,
  vimOn,
  onToggleVim,
  writingDisplay,
  onWritingFontSizeChange,
  onWritingLineHeightChange,
  onReadingFontSizeChange,
  onReadingWidthChange,
  onProseFontFamilyChange,
  onResetWritingDisplay,
}: TitleBarProps) {
  const { t } = useI18n();

  return (
    <header className="mdv-titlebar" data-tauri-drag-region onMouseDown={startWindowDrag}>
      <div className="mdv-titlebar__lead" data-tauri-drag-region />

      <div className="mdv-titlebar__center" data-tauri-drag-region>
        {fileName ? (
          <span
            className="mdv-titlebar__filename"
            data-tauri-drag-region
            title={filePath ?? fileName}
          >
            {fileName}
            {dirty ? (
              <span
                className="mdv-titlebar__dot"
                aria-label={t("title.unsavedChanges")}
                data-tauri-drag-region
              />
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="mdv-titlebar__actions" data-tauri-drag-region>
        {readingMode ? (
          <ThemeButton
            vimOn={vimOn}
            onToggleVim={onToggleVim}
            writingDisplay={writingDisplay}
            onWritingFontSizeChange={onWritingFontSizeChange}
            onWritingLineHeightChange={onWritingLineHeightChange}
            onReadingFontSizeChange={onReadingFontSizeChange}
            onReadingWidthChange={onReadingWidthChange}
            onProseFontFamilyChange={onProseFontFamilyChange}
            onResetWritingDisplay={onResetWritingDisplay}
          />
        ) : null}
        {readingMode && onCopyMarkdown ? (
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
        {readingMode && onExportPdf ? (
          <Button
            data-tooltip={shortcutLabel(t("app.exportPdfShortcut"))}
            aria-label={t("app.exportPdf")}
            onClick={onExportPdf}
            icon={<Icon icon={FileDown} size={13} strokeWidth={1.5} />}
          />
        ) : null}
        {/* reading mode exit — breadcrumb is hidden in reading mode so keep here */}
        {onToggleReading && readingMode ? (
          <Button
            data-tooltip={t("title.exitReadingTooltip")}
            aria-label={t("title.exitReading")}
            onClick={onToggleReading}
            icon={<Icon icon={Minimize2} size={14} strokeWidth={1.5} />}
          />
        ) : null}
      </div>
    </header>
  );
}
