import { CircleHelp, Settings } from "lucide-react";
import { Button, Icon } from "@/components/primitives";
import { formatTokens, shortcutLabel, startWindowDrag } from "@/lib";

export type VimMode = "normal" | "insert" | "visual" | "replace";

type StatusBarProps = {
  fileName?: string;
  words: number;
  minutes: number;
  /** rough token count of the currently-loaded buffer */
  docTokens: number;
  onShowHelp: () => void;
  onShowSettings: () => void;
  /** when set, renders a vim-mode pill at the bottom-left (#23) */
  vimMode?: VimMode | null;
};

function vimModeLabel(mode: VimMode): string {
  switch (mode) {
    case "normal":
      return "NORMAL";
    case "insert":
      return "INSERT";
    case "visual":
      return "VISUAL";
    case "replace":
      return "REPLACE";
  }
}

export function StatusBar({
  fileName,
  words,
  minutes,
  docTokens,
  onShowHelp,
  onShowSettings,
  vimMode,
}: StatusBarProps) {
  return (
    <footer className="mdv-statusbar" data-tauri-drag-region onMouseDown={startWindowDrag}>
      <div className="mdv-statusbar__group" data-tauri-drag-region>
        {vimMode ? (
          <span className={`mdv-vim-pill mdv-vim-pill--${vimMode}`}>{vimModeLabel(vimMode)}</span>
        ) : null}
        <span data-tauri-drag-region>{fileName ?? "untitled"}</span>
      </div>
      <div className="mdv-statusbar__group" data-tauri-drag-region>
        <span>
          {words} {words === 1 ? "word" : "words"}
        </span>
        <span>·</span>
        <span>~{formatTokens(docTokens)} tokens</span>
        <span>·</span>
        <span>{minutes} min read</span>
        <span className="mdv-statusbar__utilities">
          <Button
            className="mdv-statusbar__utility"
            data-tooltip={shortcutLabel("settings (⌘,)")}
            aria-label="settings"
            onClick={onShowSettings}
            icon={<Icon icon={Settings} size={12} strokeWidth={1.5} />}
          />
          <Button
            className="mdv-statusbar__utility mdv-statusbar__help"
            data-tooltip={shortcutLabel("how to use (⌘/)")}
            aria-label="how to use"
            onClick={onShowHelp}
            icon={<Icon icon={CircleHelp} size={12} strokeWidth={1.5} />}
          />
        </span>
      </div>
    </footer>
  );
}
