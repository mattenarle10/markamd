import { useEffect, useRef, type WheelEvent } from "react";
import { X } from "lucide-react";
import { Icon } from "@/components/primitives";
import type { FileTab } from "@/hooks/use-file-session";
import { useI18n } from "@/lib";

type OpenTabsProps = {
  tabs: FileTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
};

export function OpenTabs({ tabs, activeTabId, onSelect, onClose }: OpenTabsProps) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(".mdv-tab.is-active");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId, tabs.length]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const el = listRef.current;
    if (!el) return;
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    if (el.scrollWidth <= el.clientWidth) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY;
  };

  return (
    <div
      ref={listRef}
      className="mdv-tabs"
      role="tablist"
      aria-label={t("tabs.openFiles")}
      onWheel={handleWheel}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const dirty = tab.source !== tab.savedContent;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            className={`mdv-tab${active ? " is-active" : ""}${dirty ? " is-dirty" : ""}`}
            title={tab.path ?? tab.title}
          >
            <button
              type="button"
              className="mdv-tab__select"
              onClick={() => onSelect(tab.id)}
            >
              <span className="mdv-tab__dot" aria-hidden="true" />
              <span className="mdv-tab__label">{tab.title}</span>
            </button>
            <button
              type="button"
              className="mdv-tab__close"
              aria-label={t("tabs.close", { name: tab.title })}
              data-tooltip={t("tabs.close", { name: tab.title })}
              onClick={() => onClose(tab.id)}
            >
              <Icon icon={X} size={13} strokeWidth={1.8} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
