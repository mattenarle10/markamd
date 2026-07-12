import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, Sparkles } from "lucide-react";
import { Button, Icon, Kbd, Overlay, Shortcut } from "@/components/primitives";
import logoUrl from "@/assets/mascot/mdview-transpa-bg.png";
import notebookUrl from "@/assets/mascot/notebook.png";
import penUrl from "@/assets/mascot/pen.png";
import inspectUrl from "@/assets/mascot/inspect.png";
import exciteUrl from "@/assets/mascot/excite.png";

type WelcomeOverlayProps = {
  open: boolean;
  onClose: () => void;
  onOpenFolder: () => void;
};

type Slide = {
  mascot: string;
  title: string;
  body: ReactNode;
};

const SLIDES: Slide[] = [
  {
    mascot: logoUrl,
    title: "welcome to marka.md",
    body: (
      <>
        a local markdown editor for one loop:{" "}
        <strong>collect notes → write → stage context → share</strong>. nothing leaves your machine until you copy.
      </>
    ),
  },
  {
    mascot: notebookUrl,
    title: "open your workspace",
    body: (
      <>
        press <Shortcut keys="⌘+⇧+O" /> to load a folder. use <Shortcut keys="⌘+T" /> for a new tab, then <Shortcut keys="⌘+1" /> through <Shortcut keys="⌘+9" /> to jump between drafts.
      </>
    ),
  },
  {
    mascot: penUrl,
    title: "write with live preview",
    body: (
      <>
        type on the left, preview on the right. use <Shortcut keys="⌘+K" /> to insert tables, lists, and code blocks without leaving the keyboard.
      </>
    ),
  },
  {
    mascot: inspectUrl,
    title: "stage context",
    body: (
      <>
        click the context buttons beside sidebar files. the tray shows file count + tokens, then copies one clean bundle for ai chat.
      </>
    ),
  },
  {
    mascot: inspectUrl,
    title: "read and share",
    body: (
      <>
        <Shortcut keys="⌘+." /> opens reading mode. copy markdown with <Shortcut keys="⌘+⇧+C" /> or export a clean pdf with <Shortcut keys="⌘+P" />.
      </>
    ),
  },
  {
    mascot: exciteUrl,
    title: "make it yours",
    body: (
      <>
        use <Shortcut keys="⌘+K" /> for files, workspace actions, markdown inserts, themes, updates, help, and the demo doc. happy writing.
      </>
    ),
  },
];

export function WelcomeOverlay({ open, onClose, onOpenFolder }: WelcomeOverlayProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const slide = SLIDES[step];
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;

  const next = () => setStep((s) => Math.min(SLIDES.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (isLast) {
          onClose();
          void onOpenFolder();
        } else {
          next();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isLast, onClose, onOpenFolder]);

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="welcome to marka.md" variant="modal">
      <div className="mdv-welcome">
        <div className="mdv-welcome__slide" key={step}>
          <img
            src={slide.mascot}
            alt=""
            aria-hidden
            width={140}
            height={140}
            draggable={false}
            className="mdv-welcome__art"
          />
          <h1 className="mdv-welcome__title">{slide.title}</h1>
          <p className="mdv-welcome__body">{slide.body}</p>
        </div>

        <div className="mdv-welcome__dots" aria-label="tutorial progress">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`mdv-welcome__dot${i === step ? " is-active" : ""}`}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              aria-label={`step ${i + 1}`}
            />
          ))}
        </div>

        <div className="mdv-welcome__actions">
          {!isFirst ? (
            <Button
              onClick={prev}
              icon={<Icon icon={ChevronLeft} size={14} strokeWidth={1.75} />}
            >
              back
            </Button>
          ) : (
            <Button onClick={onClose}>skip</Button>
          )}
          {isLast ? (
            <>
              <Button
                onClick={onClose}
                icon={<Icon icon={Sparkles} size={14} strokeWidth={1.75} />}
              >
                explore the demo
              </Button>
              <Button
                variant="solid"
                onClick={() => {
                  onClose();
                  void onOpenFolder();
                }}
                icon={<Icon icon={FolderOpen} size={14} strokeWidth={1.75} />}
              >
                open a folder
              </Button>
            </>
          ) : (
            <Button
              variant="solid"
              onClick={next}
              iconRight={<Icon icon={ChevronRight} size={14} strokeWidth={1.75} />}
            >
              next
            </Button>
          )}
        </div>

        <div className="mdv-welcome__hint">
          {isLast ? (
            <>
              <Shortcut keys="⌘+⇧+O" /> <span>open a folder</span>
              <span className="mdv-welcome__hint-sep">·</span>
              <Kbd>↵</Kbd> <span>or click</span>
              <span className="mdv-welcome__hint-sep">·</span>
              <Kbd>esc</Kbd> <span>close</span>
            </>
          ) : (
            <>
              <Kbd>↵</Kbd> <span>or</span> <Kbd>→</Kbd> <span>next</span>
              <span className="mdv-welcome__hint-sep">·</span>
              <Kbd>esc</Kbd> <span>close</span>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}
