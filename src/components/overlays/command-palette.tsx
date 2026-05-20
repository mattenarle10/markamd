import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Kbd, Overlay } from "@/components/primitives";
import { shortcutLabel } from "@/lib";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Command, type CommandCategory } from "@/lib/commands";

export type { Command };

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  commands: Command[];
};

type RenderRow =
  | { kind: "header"; key: string; label: string }
  | { kind: "item"; key: string; cmd: Command; index: number };

function buildRows(commands: Command[], grouped: boolean): RenderRow[] {
  if (!grouped) {
    return commands.map((cmd, i) => ({ kind: "item", key: cmd.id, cmd, index: i }));
  }

  const byCategory = new Map<CommandCategory | "other", Command[]>();
  for (const cmd of commands) {
    const key = cmd.category ?? "other";
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(cmd);
    else byCategory.set(key, [cmd]);
  }

  const rows: RenderRow[] = [];
  let index = 0;
  for (const cat of CATEGORY_ORDER) {
    const bucket = byCategory.get(cat);
    if (!bucket || bucket.length === 0) continue;
    rows.push({ kind: "header", key: `h-${cat}`, label: CATEGORY_LABELS[cat] });
    for (const cmd of bucket) {
      rows.push({ kind: "item", key: cmd.id, cmd, index });
      index += 1;
    }
  }
  // anything without a category falls under "other"
  const other = byCategory.get("other");
  if (other && other.length > 0) {
    rows.push({ kind: "header", key: "h-other", label: "other" });
    for (const cmd of other) {
      rows.push({ kind: "item", key: cmd.id, cmd, index });
      index += 1;
    }
  }
  return rows;
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = `${c.label} ${c.hint ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, commands]);

  const rows = useMemo(
    () => buildRows(filtered, query.trim().length === 0),
    [filtered, query],
  );

  const itemCount = useMemo(() => rows.filter((r) => r.kind === "item").length, [rows]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(itemCount - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) {
          onClose();
          void cmd.action();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, filtered, activeIndex, itemCount]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="command palette" variant="palette">
      <div className="mdv-palette__search">
        <input
          ref={inputRef}
          className="mdv-palette__input"
          placeholder="type a command…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <ul className="mdv-palette__list" role="listbox" ref={listRef}>
        {rows.length === 0 ? (
          <li className="mdv-palette__empty">no matches</li>
        ) : (
          rows.map((row) => {
            if (row.kind === "header") {
              return (
                <li key={row.key} className="mdv-palette__group" role="presentation">
                  {row.label}
                </li>
              );
            }
            const { cmd, index } = row;
            return (
              <li
                key={row.key}
                data-index={index}
                className={`mdv-palette__item${index === activeIndex ? " is-active" : ""}`}
                onClick={() => {
                  onClose();
                  void cmd.action();
                }}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                aria-selected={index === activeIndex}
              >
                {cmd.icon ? (
                  <span className="mdv-palette__icon">
                    <Icon icon={cmd.icon} size={14} strokeWidth={1.5} />
                  </span>
                ) : null}
                <span className="mdv-palette__label">
                  {cmd.label}
                  {cmd.hint ? <span className="mdv-palette__hint"> · {cmd.hint}</span> : null}
                </span>
                {cmd.shortcut ? <Kbd className="mdv-kbd--muted">{shortcutLabel(cmd.shortcut)}</Kbd> : null}
              </li>
            );
          })
        )}
      </ul>
      <div className="mdv-palette__footer">
        <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
        <span><Kbd>↵</Kbd> run</span>
        <span><Kbd>esc</Kbd> close</span>
      </div>
    </Overlay>
  );
}
