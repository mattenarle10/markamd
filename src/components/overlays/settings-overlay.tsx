import { RotateCcw, Settings, Sparkles, Terminal, X } from "lucide-react";
import { Button, Icon, Overlay } from "@/components/primitives";
import {
  LANGUAGE_CHOICES,
  PROSE_FONT_FAMILY_OPTIONS,
  READING_FONT_SIZE_OPTIONS,
  READING_WIDTH_OPTIONS,
  WRITING_FONT_SIZE_OPTIONS,
  WRITING_LINE_HEIGHT_OPTIONS,
  useI18n,
  useTransparency,
  type Language,
  type ProseFontFamily,
  type ReadingFontSize,
  type ReadingWidth,
  type StartupMode,
  type WritingDisplay,
  type WritingFontSize,
  type WritingLineHeight,
} from "@/lib";

type SettingsOverlayProps = {
  open: boolean;
  vimOn: boolean;
  onToggleVim: () => void;
  writingDisplay: WritingDisplay;
  onWritingFontSizeChange: (value: WritingFontSize) => void;
  onWritingLineHeightChange: (value: WritingLineHeight) => void;
  onReadingFontSizeChange: (value: ReadingFontSize) => void;
  onReadingWidthChange: (value: ReadingWidth) => void;
  onProseFontFamilyChange: (value: ProseFontFamily) => void;
  onResetWritingDisplay: () => void;
  startupMode: StartupMode;
  onStartupModeChange: (value: StartupMode) => void;
  onClose: () => void;
};

export function SettingsOverlay({
  open,
  vimOn,
  onToggleVim,
  writingDisplay,
  onWritingFontSizeChange,
  onWritingLineHeightChange,
  onReadingFontSizeChange,
  onReadingWidthChange,
  onProseFontFamilyChange,
  onResetWritingDisplay,
  startupMode,
  onStartupModeChange,
  onClose,
}: SettingsOverlayProps) {
  const { language, setLanguage, t } = useI18n();
  const { opacity, on: transparent, set: setTransparency } = useTransparency();

  const options = <T extends string>(
    label: string,
    value: T,
    options: readonly T[],
    labelFor: (option: T) => string,
    onChange: (value: T) => void,
  ) => {
    return (
      <div className="mdv-settings__options">
        <div className="mdv-settings__control-head">
          <span>{label}</span>
          <span className="mdv-settings__value">{labelFor(value)}</span>
        </div>
        <div className="mdv-settings__option-list" role="group" aria-label={label}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={option === value ? "is-selected" : ""}
              aria-pressed={option === value}
              onClick={() => onChange(option)}
            >
              {labelFor(option)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const select = <T extends string>(
    label: string,
    value: T,
    options: readonly T[],
    labelFor: (option: T) => string,
    onChange: (value: T) => void,
  ) => (
    <label className="mdv-settings__row">
      <span className="mdv-settings__label">{label}</span>
      <select
        className="mdv-settings__select"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={label}
      >
        {options.map((option) => <option key={option} value={option}>{labelFor(option)}</option>)}
      </select>
    </label>
  );

  return (
    <Overlay open={open} onClose={onClose} ariaLabel={t("settings.aria")} variant="modal">
      <header className="mdv-settings__header">
        <div className="mdv-settings__title">
          <Icon icon={Settings} size={15} strokeWidth={1.6} />
          <span>{t("settings.title")}</span>
        </div>
        <Button
          title={t("app.closeEsc")}
          aria-label={t("app.close")}
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <div className="mdv-settings__body">
        <section className="mdv-settings__section">
          <h3 className="mdv-settings__heading">{t("settings.appearance")}</h3>
          <button
            type="button"
            className={`mdv-settings__toggle${transparent ? " is-on" : ""}`}
            onClick={() => setTransparency(transparent ? 100 : 74)}
            aria-pressed={transparent}
          >
            <div className="mdv-settings__control-head">
              <span><Icon icon={Sparkles} size={13} strokeWidth={1.5} />{t("settings.transparency")}</span>
              <span className="mdv-settings__value">{opacity >= 100 ? t("settings.off") : `${100 - opacity}%`}</span>
            </div>
            <span className="mdv-settings__switch" aria-hidden />
          </button>
          {select(t("settings.language"), language, LANGUAGE_CHOICES.map(({ value }) => value), (value) => LANGUAGE_CHOICES.find((choice) => choice.value === value)?.nativeLabel ?? value, (value) => setLanguage(value as Language))}
        </section>

        <section className="mdv-settings__section">
          <h3 className="mdv-settings__heading">{t("settings.editor")}</h3>
          <button type="button" className={`mdv-settings__toggle${vimOn ? " is-on" : ""}`} onClick={onToggleVim} aria-pressed={vimOn}>
            <span><Icon icon={Terminal} size={13} strokeWidth={1.5} />{t("settings.vimMode")}</span>
            <span className="mdv-settings__switch" aria-hidden />
          </button>
          {options(t("settings.writingFont"), writingDisplay.fontSize, WRITING_FONT_SIZE_OPTIONS, (value) => t(`writing.font.${value}`), onWritingFontSizeChange)}
          {options(t("settings.writingSpacing"), writingDisplay.lineHeight, WRITING_LINE_HEIGHT_OPTIONS, (value) => t(`writing.spacing.${value}`), onWritingLineHeightChange)}
        </section>

        <section className="mdv-settings__section">
          <h3 className="mdv-settings__heading">{t("settings.reading")}</h3>
          {options(t("settings.readingSize"), writingDisplay.readingFontSize, READING_FONT_SIZE_OPTIONS, (value) => t(`writing.font.${value}`), onReadingFontSizeChange)}
          {options(t("settings.readingWidth"), writingDisplay.readingWidth, READING_WIDTH_OPTIONS, (value) => t(`reading.width.${value}`), onReadingWidthChange)}
          {select(t("settings.previewFont"), writingDisplay.proseFontFamily, PROSE_FONT_FAMILY_OPTIONS, (value) => t(`prose.font.${value}`), onProseFontFamilyChange)}
          <button type="button" className="mdv-settings__reset" onClick={onResetWritingDisplay}>
            <Icon icon={RotateCcw} size={13} strokeWidth={1.5} />{t("settings.resetText")}
          </button>
        </section>

        <section className="mdv-settings__section">
          <h3 className="mdv-settings__heading">{t("settings.startup")}</h3>
          <label className="mdv-settings__row">
            <span className="mdv-settings__copy">
              <span className="mdv-settings__label">{t("settings.startupLabel")}</span>
              <span className="mdv-settings__description">{t("settings.startupDescription")}</span>
            </span>
            <select
              className="mdv-settings__select"
              value={startupMode}
              aria-label={t("settings.startupLabel")}
              onChange={(event) => onStartupModeChange(event.target.value as StartupMode)}
            >
              <option value="welcome">{t("settings.showWelcome")}</option>
              <option value="blank">{t("settings.startBlank")}</option>
            </select>
          </label>
          <p className="mdv-settings__note">{t("settings.appliesNextLaunch")}</p>
        </section>
      </div>
    </Overlay>
  );
}
