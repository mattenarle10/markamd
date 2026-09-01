import { Settings, X } from "lucide-react";
import { Button, Icon, Overlay } from "@/components/primitives";
import { useI18n, type StartupMode } from "@/lib";

type SettingsOverlayProps = {
  open: boolean;
  startupMode: StartupMode;
  onStartupModeChange: (value: StartupMode) => void;
  onClose: () => void;
};

export function SettingsOverlay({
  open,
  startupMode,
  onStartupModeChange,
  onClose,
}: SettingsOverlayProps) {
  const { t } = useI18n();

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
