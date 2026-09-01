import { useEffect, useState } from "react";
import { Download, FileText, Layers3, Palette, Sparkles, Table2, X } from "lucide-react";
import { Button, Icon, Kbd, Overlay, Shortcut } from "@/components/primitives";
import { shortcutLabel, useI18n, type Translate } from "@/lib";
import writeUrl from "@/assets/mascot/write.png";

type HelpOverlayProps = {
  open: boolean;
  onClose: () => void;
  onReplayTutorial?: () => void;
  onCheckForUpdates?: () => void | Promise<void>;
};

type Row = { keys: string; label: string };

type Group = { title: string; rows: Row[] };

function getFeatureCards(t: Translate) {
  return [
    {
      icon: FileText,
      title: t("help.feature.markdown.title"),
      body: t("help.feature.markdown.body"),
    },
    {
      icon: Layers3,
      title: t("help.feature.context.title"),
      body: t("help.feature.context.body"),
    },
    {
      icon: Table2,
      title: t("help.feature.csv.title"),
      body: t("help.feature.csv.body"),
    },
    {
      icon: Palette,
      title: t("help.feature.themes.title"),
      body: t("help.feature.themes.body"),
    },
  ];
}

function getGroups(t: Translate): Group[] {
  return [
  {
    title: t("help.file"),
    rows: [
      { keys: "⌘+⇧+O", label: t("help.openFolder") },
      { keys: "⌘+O", label: t("help.openFile") },
      { keys: "⌘+N", label: t("help.newUntitled") },
      { keys: "⌘+T", label: t("help.newTab") },
      { keys: "⌘+S", label: t("help.saveCurrent") },
      { keys: "⌘+⇧+S", label: t("help.saveAs") },
      { keys: "⌘+⌥+Z", label: t("help.undoSidebar") },
    ],
  },
  {
    title: t("help.workspace"),
    rows: [
      { keys: "⌘+K", label: t("help.openPalette") },
      { keys: "⌘+B", label: t("help.showHideSidebar") },
      { keys: "⌘+1…9", label: t("help.switchTab") },
      { keys: "⌘+.", label: t("help.toggleReading") },
      { keys: "⌘+⇧+.", label: t("help.toggleEditorOnly") },
      { keys: "⌘+=", label: t("help.zoomIn") },
      { keys: "⌘+-", label: t("help.zoomOut") },
      { keys: "⌘+0", label: t("help.zoomReset") },
      { keys: "⌃+⌘+F", label: t("help.toggleFullscreen") },
    ],
  },
  {
    title: t("help.edit"),
    rows: [
      { keys: "⌘+K", label: t("help.insertMarkdown") },
      { keys: "⌘+F", label: t("help.findReplace") },
      { keys: "⌘+G", label: t("help.findNext") },
    ],
  },
  {
    title: t("help.share"),
    rows: [
      { keys: "⌘+⇧+C", label: t("help.copyMarkdown") },
      { keys: "⌘+P", label: t("help.exportPdf") },
    ],
  },
  {
    title: t("help.help"),
    rows: [
      { keys: "⌘+/", label: t("help.openThis") },
      { keys: "⌘+,", label: t("help.openSettings") },
      { keys: "esc", label: t("help.closeAny") },
    ],
  },
  ];
}

function getTips(t: Translate): string[] {
  return Array.from({ length: 8 }, (_, i) => t(`help.tip${i + 1}`));
}

export function HelpOverlay({ open, onClose, onReplayTutorial, onCheckForUpdates }: HelpOverlayProps) {
  const { t } = useI18n();
  const [checking, setChecking] = useState(false);
  const features = getFeatureCards(t);
  const groups = getGroups(t);
  const tips = getTips(t);

  const handleCheck = async () => {
    if (!onCheckForUpdates || checking) return;
    setChecking(true);
    try {
      await onCheckForUpdates();
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!open || !onReplayTutorial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onClose();
        onReplayTutorial();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onReplayTutorial, onClose]);

  return (
    <Overlay open={open} onClose={onClose} ariaLabel={t("help.aria")} variant="modal">
      <header className="mdv-help__header">
        <div className="mdv-help__title">
          <img
            src={writeUrl}
            alt=""
            aria-hidden
            width={36}
            height={36}
            draggable={false}
            className="mdv-help__art"
          />
          <div className="mdv-help__title-text">
            <span className="mdv-help__brand">marka.md</span>
            <span className="mdv-help__subtitle">{t("help.subtitle")}</span>
          </div>
        </div>
        <Button
          title={t("app.closeEsc")}
          aria-label={t("app.close")}
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <div className="mdv-help__body">
        <section className="mdv-help__section">
          <h3 className="mdv-help__h">{t("help.features")}</h3>
          <div className="mdv-help__features">
            {features.map((feature) => (
              <article key={feature.title} className="mdv-help__feature">
                <span className="mdv-help__feature-icon" aria-hidden>
                  <Icon icon={feature.icon} size={14} strokeWidth={1.6} />
                </span>
                <span className="mdv-help__feature-title">{feature.title}</span>
                <span className="mdv-help__feature-body">{feature.body}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="mdv-help__section">
          <h3 className="mdv-help__h">{t("help.shortcuts")}</h3>
          <div className="mdv-help__groups">
            {groups.map((g) => (
              <div key={g.title} className="mdv-help__group">
                <div className="mdv-help__group-title">{g.title}</div>
                <ul className="mdv-help__list">
                  {g.rows.map((s) => (
                    <li key={s.label} className="mdv-help__row">
                      <span className="mdv-help__keys">
                        {s.keys.includes("+") ? (
                          <Shortcut keys={s.keys} />
                        ) : (
                          <Kbd>{s.keys}</Kbd>
                        )}
                      </span>
                      <span className="mdv-help__label">{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mdv-help__section">
          <h3 className="mdv-help__h">{t("help.tips")}</h3>
          <ul className="mdv-help__tips">
            {tips.map((tip) => (
              <li key={tip}>{shortcutLabel(tip)}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="mdv-help__footer">
        <span>marka.md · MIT · open source</span>
        <div className="mdv-help__actions">
          {onCheckForUpdates ? (
            <button
              type="button"
              className="mdv-help__action"
              onClick={() => void handleCheck()}
              disabled={checking}
            >
              <Download size={11} strokeWidth={1.75} />
              {checking ? "checking…" : t("command.checkUpdates")}
            </button>
          ) : null}
          {onReplayTutorial ? (
            <button
              type="button"
              className="mdv-help__action"
              onClick={() => {
                onClose();
                onReplayTutorial();
              }}
            >
              <Sparkles size={11} strokeWidth={1.75} />
              {t("help.replay")}
            </button>
          ) : null}
        </div>
      </footer>
    </Overlay>
  );
}
