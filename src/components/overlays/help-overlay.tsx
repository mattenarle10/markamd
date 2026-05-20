import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { Button, Icon, Kbd, Overlay, Shortcut } from "@/components/primitives";
import { shortcutLabel } from "@/lib";
import writeUrl from "@/assets/mascot/write.png";

type HelpOverlayProps = {
  open: boolean;
  onClose: () => void;
  onReplayTutorial?: () => void;
};

type Row = { keys: string; label: string };

type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: "file",
    rows: [
      { keys: "⌘+⇧+O", label: "open a folder of notes" },
      { keys: "⌘+O", label: "open a single .md file" },
      { keys: "⌘+N", label: "new untitled buffer" },
      { keys: "⌘+S", label: "save current file" },
      { keys: "⌘+⇧+S", label: "save as / copy to new location" },
      { keys: "⌘+⌥+Z", label: "undo last sidebar file action" },
    ],
  },
  {
    title: "view",
    rows: [
      { keys: "⌘+K", label: "open command palette" },
      { keys: "⌘+B", label: "show / hide sidebar" },
      { keys: "⌘+.", label: "toggle reading mode" },
      { keys: "⌃+⌘+F", label: "toggle fullscreen" },
    ],
  },
  {
    title: "edit",
    rows: [
      { keys: "⌘+F", label: "find / replace in editor" },
      { keys: "⌘+G", label: "find next match" },
    ],
  },
  {
    title: "share",
    rows: [
      { keys: "⌘+⇧+C", label: "copy markdown to clipboard" },
      { keys: "⌘+P", label: "export to pdf" },
    ],
  },
  {
    title: "help",
    rows: [
      { keys: "⌘+/", label: "open this help" },
      { keys: "esc", label: "close any popup / overlay" },
    ],
  },
];

const TIPS = [
  "marka.md is built around one loop: collect notes → write → share with ai. nothing leaves your machine until you press copy.",
  "open a folder to turn the sidebar into your context library. tap the 🔍 to search every .md across the tree.",
  "press ⌘. for distraction-free reading mode — great for proofing before pasting into any ai chat.",
  "⌘⇧C copies the current file as plain markdown. drop it straight into any chat.",
  "drag the divider between editor and preview to resize. ratio is remembered per session.",
  "code blocks have a hover-to-show copy button. mermaid + shiki all render live.",
];

export function HelpOverlay({ open, onClose, onReplayTutorial }: HelpOverlayProps) {
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
    <Overlay open={open} onClose={onClose} ariaLabel="how to use marka.md" variant="modal">
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
            <span className="mdv-help__subtitle">keyboard + tips</span>
          </div>
        </div>
        <Button
          title="close (esc)"
          aria-label="close"
          onClick={onClose}
          icon={<Icon icon={X} size={14} strokeWidth={1.5} />}
        />
      </header>

      <div className="mdv-help__body">
        <section className="mdv-help__section">
          <h3 className="mdv-help__h">shortcuts</h3>
          <div className="mdv-help__groups">
            {GROUPS.map((g) => (
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
          <h3 className="mdv-help__h">tips</h3>
          <ul className="mdv-help__tips">
            {TIPS.map((tip) => (
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
            replay tutorial
          </button>
        ) : null}
      </footer>
    </Overlay>
  );
}
