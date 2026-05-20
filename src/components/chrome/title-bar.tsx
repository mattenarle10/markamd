import { useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Cloud,
  Coffee,
  Copy,
  FileDown,
  Flower2,
  Leaf,
  Minimize2,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Sunset,
  Waves,
} from "lucide-react";
import { Button, Icon, Popover } from "@/components/primitives";
import { getSystemTheme, previewTheme, shortcutLabel, startWindowDrag, useThemeMode, useTransparency, type Theme, type ThemeMode } from "@/lib";

type TitleBarProps = {
  fileName?: string;
  /** full path of the active file — shown on hover over the centered filename */
  filePath?: string | null;
  dirty?: boolean;
  readingMode?: boolean;
  onToggleReading?: () => void;
  /** shown in title-bar only while reading mode is on */
  onCopyMarkdown?: () => void;
  copyPulse?: boolean;
  onExportPdf?: () => void;
};

type ThemeChoice = { value: ThemeMode; label: string; icon: typeof Sun };

const THEME_CHOICES: ThemeChoice[] = [
  { value: "system", label: "system", icon: Monitor },
  { value: "latte", label: "latte", icon: Sun },
  { value: "matcha", label: "matcha", icon: Leaf },
  { value: "frappe", label: "frappé", icon: Cloud },
  { value: "macchiato", label: "macchiato", icon: Coffee },
  { value: "mocha", label: "mocha", icon: Moon },
  { value: "kanagawa", label: "kanagawa", icon: Waves },
  { value: "rose-pine", label: "rose pine", icon: Flower2 },
  { value: "ayu", label: "ayu", icon: Sunset },
];

export function TitleBar({
  fileName,
  filePath,
  dirty = false,
  readingMode = false,
  onToggleReading,
  onCopyMarkdown,
  copyPulse = false,
  onExportPdf,
}: TitleBarProps) {
  const { mode, resolved, setMode } = useThemeMode();
  const { opacity, on: transparent, set: setTransparency } = useTransparency();
  const [menuOpen, setMenuOpen] = useState(false);
  const themeAnchorRef = useRef<HTMLDivElement>(null);
  // hover = preview only (DOM-level, no storage write).
  // moving between items keeps the preview (no flash).
  // mouse-leave the ENTIRE menu OR popover close = revert to stored.
  // click = commit (setMode → writes storage + applies).
  const hoverTimer = useRef<number | null>(null);
  const resolveThemeForPreview = (value: ThemeMode): Theme =>
    value === "system" ? getSystemTheme() : value;
  const previewOnHover = (value: ThemeMode) => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      previewTheme(resolveThemeForPreview(value));
      hoverTimer.current = null;
    }, 60);
  };
  const cancelHoverTimer = () => {
    // cancel a PENDING preview without reverting — used when cursor leaves an
    // item but is still inside the menu (moving to another item).
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  const cancelPreview = () => {
    cancelHoverTimer();
    previewTheme(null);
  };

  // ActiveIcon is the resolved theme's icon (single source of truth: THEME_CHOICES).
  // Avoids drift when adding new themes — add one entry to THEME_CHOICES, done.
  const ActiveIcon =
    mode === "system"
      ? Monitor
      : (THEME_CHOICES.find((c) => c.value === resolved)?.icon ?? Coffee);

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
            {dirty ? <span className="mdv-titlebar__dot" aria-label="unsaved changes" data-tauri-drag-region /> : null}
          </span>
        ) : null}
      </div>

      <div className="mdv-titlebar__actions" data-tauri-drag-region>
        {readingMode && onCopyMarkdown ? (
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
        {readingMode && onExportPdf ? (
          <Button
            data-tooltip={shortcutLabel("export to pdf (⌘P)")}
            aria-label="export to pdf"
            onClick={onExportPdf}
            icon={<Icon icon={FileDown} size={13} strokeWidth={1.5} />}
          />
        ) : null}
        {onToggleReading ? (
          <Button
            data-tooltip={readingMode ? "exit reading (esc)" : shortcutLabel("reading mode (⌘.)")}
            aria-label={readingMode ? "exit reading mode" : "reading mode"}
            aria-pressed={readingMode}
            onClick={onToggleReading}
            icon={<Icon icon={readingMode ? Minimize2 : BookOpen} size={14} strokeWidth={1.5} />}
          />
        ) : null}
        <div className="mdv-titlebar__theme" ref={themeAnchorRef}>
          <Button
            data-tooltip="theme & transparency"
            aria-label="theme"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            icon={<Icon icon={ActiveIcon} size={14} strokeWidth={1.5} />}
          />
          <Popover
            open={menuOpen}
            onClose={() => {
              cancelPreview();
              setMenuOpen(false);
            }}
            anchorRef={themeAnchorRef}
          >
            <div className="mdv-menu" onMouseLeave={cancelPreview}>
              <div className="mdv-menu__label">theme</div>
              {THEME_CHOICES.map((c) => {
                const active = mode === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    className={`mdv-menu__item${active ? " is-active" : ""}`}
                    onMouseEnter={() => previewOnHover(c.value)}
                    onMouseLeave={cancelHoverTimer}
                    onFocus={() => previewOnHover(c.value)}
                    onBlur={cancelHoverTimer}
                    onClick={() => {
                      // click commits immediately + closes menu
                      cancelPreview();
                      setMode(c.value);
                      setMenuOpen(false);
                    }}
                    role="menuitemradio"
                    aria-checked={active}
                  >
                    <span className="mdv-menu__item-icon">
                      <Icon icon={c.icon} size={14} strokeWidth={1.5} />
                    </span>
                    <span className="mdv-menu__item-label">{c.label}</span>
                    {active ? (
                      <span className="mdv-menu__item-check">
                        <Icon icon={Check} size={13} strokeWidth={2} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
              <div className="mdv-menu__divider" aria-hidden />
              <div className={`mdv-menu__slider${transparent ? " is-active" : ""}`}>
                <span className="mdv-menu__slider-icon" aria-hidden>
                  <Icon icon={Sparkles} size={14} strokeWidth={1.5} />
                </span>
                <span className="mdv-menu__slider-label">transparency</span>
                <span className="mdv-menu__slider-value" aria-hidden>
                  {opacity >= 100 ? "off" : `${100 - opacity}%`}
                </span>
                <input
                  type="range"
                  className="mdv-menu__slider-input"
                  min={0}
                  max={100}
                  step={1}
                  /* invert: slider RIGHT = more transparent (lower opacity)
                     so the value-label "% transparent" maps left→right cleanly. */
                  value={100 - opacity}
                  onChange={(e) => setTransparency(100 - Number(e.target.value))}
                  aria-label="window transparency"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={100 - opacity}
                  aria-valuetext={`${100 - opacity} percent transparent`}
                />
              </div>
            </div>
          </Popover>
        </div>
      </div>
    </header>
  );
}
