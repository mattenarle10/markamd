import { useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Circle,
  Cloud,
  Coffee,
  Flower2,
  Leaf,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Sunset,
  Terminal,
  Waves,
} from "lucide-react";
import { Button, Icon, Popover } from "@/components/primitives";
import {
  getSystemTheme,
  previewTheme,
  THEME_GROUPS,
  useI18n,
  useThemeMode,
  type Theme,
  type ThemeMode,
} from "@/lib";

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  system: Monitor,
  latte: Sun,
  mono: Circle,
  "mono-dark": Circle,
  frappe: Cloud,
  matcha: Leaf,
  macchiato: Coffee,
  mocha: Moon,
  kanagawa: Waves,
  "rose-pine": Flower2,
  ayu: Sunset,
  claude: Sparkles,
  codex: Terminal,
  gemini: Sparkles,
  cursor: Terminal,
};

export function ThemeButton() {
  const { t } = useI18n();
  const { mode, resolved, setMode } = useThemeMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openThemeGroups, setOpenThemeGroups] = useState<Set<string>>(
    () => new Set([THEME_GROUPS[0]?.label ?? ""]),
  );
  const anchorRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);

  const resolveThemeForPreview = (value: ThemeMode): Theme =>
    value === "system" ? getSystemTheme() : value;

  const previewOnHover = (value: ThemeMode) => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      previewTheme(resolveThemeForPreview(value));
      hoverTimer.current = null;
    }, 60);
  };

  const cancelPreview = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    previewTheme(null);
  };

  const cancelHoverTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const toggleThemeGroup = (label: string) => {
    setOpenThemeGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const ActiveIcon = mode === "system" ? Monitor : THEME_ICONS[resolved];

  return (
    <div className="mdv-titlebar__theme" ref={anchorRef}>
      <Button
        data-tooltip={t("title.themeTooltip")}
        aria-label={t("title.theme")}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
        icon={<Icon icon={ActiveIcon} size={14} strokeWidth={1.5} />}
      />
      <Popover
        open={menuOpen}
        onClose={() => {
          cancelPreview();
          setMenuOpen(false);
        }}
        anchorRef={anchorRef}
      >
        <div className="mdv-menu mdv-menu--theme" onMouseLeave={cancelPreview}>
          {THEME_GROUPS.map((group) => {
            const expanded = openThemeGroups.has(group.label);
            return (
              <section key={group.label} className={`mdv-menu__group${expanded ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="mdv-menu__group-trigger"
                  onClick={() => toggleThemeGroup(group.label)}
                  aria-expanded={expanded}
                >
                  <span>{t(`theme.group.${group.label}`)}</span>
                  <Icon icon={ChevronRight} size={13} strokeWidth={1.7} />
                </button>
                <div className="mdv-menu__group-body">
                  <div className="mdv-menu__group-inner">
                    {group.choices.map((choice) => {
                      const active = mode === choice.value;
                      return (
                        <button
                          key={choice.value}
                          type="button"
                          className={`mdv-menu__item${active ? " is-active" : ""}`}
                          onMouseEnter={() => previewOnHover(choice.value)}
                          onFocus={() => previewOnHover(choice.value)}
                          onMouseLeave={cancelHoverTimer}
                          onBlur={cancelHoverTimer}
                          onClick={() => {
                            cancelPreview();
                            setMode(choice.value);
                            setMenuOpen(false);
                          }}
                          role="menuitemradio"
                          aria-checked={active}
                        >
                          <span className="mdv-menu__item-icon">
                            <Icon icon={THEME_ICONS[choice.value]} size={14} strokeWidth={1.5} />
                          </span>
                          <span className="mdv-menu__item-label">{choice.label}</span>
                          {active ? (
                            <span className="mdv-menu__item-check">
                              <Icon icon={Check} size={13} strokeWidth={2} />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
