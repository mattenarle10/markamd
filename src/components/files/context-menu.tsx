import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/primitives";

export type ContextMenuItem =
  | {
      label: string;
      icon?: LucideIcon;
      onSelect: () => void;
      disabled?: boolean;
      hint?: string;
      /** style as destructive (red on hover) — for delete + similar */
      destructive?: boolean;
    }
  | "divider";

type ContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

const PADDING = 8;

export function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // clamp position once the menu is rendered + measured
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - PADDING;
    const maxTop = window.innerHeight - rect.height - PADDING;
    setPos({
      left: Math.max(PADDING, Math.min(maxLeft, x)),
      top: Math.max(PADDING, Math.min(maxTop, y)),
    });
  }, [open, x, y]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="mdv-menu mdv-context-menu"
      role="menu"
      style={{ position: "fixed", left: pos.left, top: pos.top }}
    >
      {items.map((item, i) => {
        if (item === "divider") {
          return <div key={`d-${i}`} className="mdv-menu__divider" aria-hidden />;
        }
        return (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role="menuitem"
            className={`mdv-menu__item${item.destructive ? " mdv-menu__item--destructive" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              onClose();
              item.onSelect();
            }}
          >
            {item.icon ? (
              <span className="mdv-menu__item-icon">
                <Icon icon={item.icon} size={13} strokeWidth={1.5} />
              </span>
            ) : (
              <span className="mdv-menu__item-icon" aria-hidden />
            )}
            <span className="mdv-menu__item-label">{item.label}</span>
            {item.hint ? <span className="mdv-menu__item-hint">{item.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
