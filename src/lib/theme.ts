import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "./storage";

export type Theme =
  | "latte"
  | "frappe"
  | "macchiato"
  | "mocha"
  | "matcha"
  | "kanagawa"
  | "rose-pine"
  | "ayu";
export type ThemeMode = "system" | Theme;

const VALID: ReadonlyArray<ThemeMode> = [
  "system",
  "latte",
  "frappe",
  "macchiato",
  "mocha",
  "matcha",
  "kanagawa",
  "rose-pine",
  "ayu",
];

const STORAGE_KEY = STORAGE_KEYS.themeMode;
const MQ = "(prefers-color-scheme: dark)";

const modeListeners = new Set<() => void>();
const transparencyListeners = new Set<() => void>();

function readMode(): ThemeMode {
  if (typeof window === "undefined") return "latte";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && (VALID as readonly string[]).includes(v)) return v as ThemeMode;
  } catch {
    // ignore
  }
  return "latte";
}

function systemTheme(): Theme {
  if (typeof window === "undefined") return "latte";
  return window.matchMedia(MQ).matches ? "mocha" : "latte";
}

function resolve(mode: ThemeMode): Theme {
  return mode === "system" ? systemTheme() : mode;
}

function apply(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const resolved = resolve(mode);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-mode", mode);
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  apply(mode);
  modeListeners.forEach((fn) => fn());
}

/**
 * Visual-only theme preview — does NOT touch localStorage or fire listeners.
 * Used by the theme menu's hover behavior: hover previews, click commits via
 * setThemeMode. Pass `null` to revert to the user's stored mode.
 */
export function previewTheme(theme: Theme | null): void {
  if (typeof document === "undefined") return;
  if (theme === null) {
    // revert to whatever's persisted
    apply(readMode());
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
}

function subscribeMode(fn: () => void): () => void {
  modeListeners.add(fn);
  return () => {
    modeListeners.delete(fn);
  };
}

function subscribeTransparency(fn: () => void): () => void {
  transparencyListeners.add(fn);
  return () => {
    transparencyListeners.delete(fn);
  };
}

const TRANSPARENCY_KEY = STORAGE_KEYS.transparency;
const TRANSPARENCY_OFF = 100;
const TRANSPARENCY_DEFAULT_ON = 74;

// Opacity is a 0-100 integer. 100 = fully opaque (off). <100 = transparency on
// at that opacity. Migrates legacy "on"/"off" string values from prior versions.
function readTransparencyOpacity(): number {
  if (typeof window === "undefined") return TRANSPARENCY_OFF;
  try {
    const v = window.localStorage.getItem(TRANSPARENCY_KEY);
    if (v === null) return TRANSPARENCY_OFF;
    if (v === "on") return TRANSPARENCY_DEFAULT_ON;
    if (v === "off") return TRANSPARENCY_OFF;
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    return TRANSPARENCY_OFF;
  } catch {
    return TRANSPARENCY_OFF;
  }
}

function applyTransparencyOpacity(opacity: number): void {
  if (typeof document === "undefined") return;
  const clamped = Math.max(0, Math.min(100, Math.round(opacity)));
  if (clamped >= TRANSPARENCY_OFF) {
    document.documentElement.removeAttribute("data-transparency");
    document.documentElement.style.removeProperty("--user-opacity");
  } else {
    document.documentElement.setAttribute("data-transparency", "on");
    document.documentElement.style.setProperty("--user-opacity", String(clamped / 100));
  }
}

export function setTransparency(opacity: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(opacity)));
  try {
    window.localStorage.setItem(TRANSPARENCY_KEY, String(clamped));
  } catch {
    // ignore
  }
  applyTransparencyOpacity(clamped);
  transparencyListeners.forEach((fn) => fn());
}

declare global {
  // eslint-disable-next-line no-var
  var __markaThemeInit: boolean | undefined;
}

if (typeof window !== "undefined" && !globalThis.__markaThemeInit) {
  globalThis.__markaThemeInit = true;
  apply(readMode());
  applyTransparencyOpacity(readTransparencyOpacity());
  const mq = window.matchMedia(MQ);
  mq.addEventListener("change", () => {
    if (readMode() === "system") {
      apply("system");
      modeListeners.forEach((fn) => fn());
    }
  });
}

export function getSystemTheme(): Theme {
  return systemTheme();
}

export function useThemeMode(): { mode: ThemeMode; resolved: Theme; setMode: (m: ThemeMode) => void } {
  const mode = useSyncExternalStore(
    subscribeMode,
    readMode,
    () => "latte" as ThemeMode,
  );
  return { mode, resolved: resolve(mode), setMode: setThemeMode };
}

export function useTransparency(): {
  /** opacity 0-100. 100 = fully opaque (off). <100 = transparency on. */
  opacity: number;
  /** convenience boolean: true when transparency is active (opacity < 100). */
  on: boolean;
  set: (opacity: number) => void;
} {
  const opacity = useSyncExternalStore(
    subscribeTransparency,
    readTransparencyOpacity,
    () => TRANSPARENCY_OFF,
  );
  return { opacity, on: opacity < TRANSPARENCY_OFF, set: setTransparency };
}

export function useTheme(): Theme {
  return useThemeMode().resolved;
}
