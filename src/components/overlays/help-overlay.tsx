import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { Button, Icon, Kbd, Overlay, Shortcut } from "@/components/primitives";
import { shortcutLabel, useI18n, type Translate } from "@/lib";
import writeUrl from "@/assets/mascot/write.png";

type HelpOverlayProps = {
  open: boolean;
  onClose: () => void;
  onReplayTutorial?: () => void;
};

type Row = { keys: string; label: string };

type Group = { title: string; rows: Row[] };

function getGroups(t: Translate): Group[] {
  return [
  {
    title: t("help.file"),
    rows: [
      { keys: "⌘+⇧+O", label: t("help.openFolder") },
      { keys: "⌘+O", label: t("help.openFile") },
      { keys: "⌘+N", label: t("help.newUntitled") },
      { keys: "⌘+S", label: t("help.saveCurrent") },
      { keys: "⌘+⇧+S", label: t("help.saveAs") },
      { keys: "⌘+⌥+Z", label: t("help.undoSidebar") },
    ],
  },
  {
    title: t("help.view"),
    rows: [
      { keys: "⌘+K", label: t("help.openPalette") },
      { keys: "⌘+B", label: t("help.showHideSidebar") },
      { keys: "⌘+.", label: t("help.toggleReading") },
      { keys: "⌃+⌘+F", label: t("help.toggleFullscreen") },
    ],
  },
  {
    title: t("help.edit"),
    rows: [
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
      { keys: "esc", label: t("help.closeAny") },
    ],
  },
  ];
}

function getTips(t: Translate): string[] {
  return Array.from({ length: 8 }, (_, i) => t(`help.tip${i + 1}`));
}

export function HelpOverlay({ open, onClose, onReplayTutorial }: HelpOverlayProps) {
  const { t } = useI18n();
  const groups = getGroups(t);
  const tips = getTips(t);
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
        <span>marka.md · open source · MIT · github.com/mattenarle10/markamd</span>
        {onReplayTutorial ? (
          <button
            type="button"
            className="mdv-help__replay"
            onClick={() => {
              onClose();
              onReplayTutorial();
            }}
          >
            <Sparkles size={11} strokeWidth={1.75} />
            {t("help.replay")}
          </button>
        ) : null}
      </footer>
    </Overlay>
  );
}
