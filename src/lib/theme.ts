import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "./storage";

export type Theme = "latte" | "frappe" | "macchiato" | "mocha" | "matcha" | "kanagawa" | "rose-pine";
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

function readTransparency(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TRANSPARENCY_KEY) === "on";
  } catch {
    return false;
  }
}

function applyTransparency(on: boolean): void {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.setAttribute("data-transparency", "on");
  else document.documentElement.removeAttribute("data-transparency");
}

export function setTransparency(on: boolean): void {
  try {
    window.localStorage.setItem(TRANSPARENCY_KEY, on ? "on" : "off");
  } catch {
    // ignore
  }
  applyTransparency(on);
  transparencyListeners.forEach((fn) => fn());
}

declare global {
  // eslint-disable-next-line no-var
  var __markaThemeInit: boolean | undefined;
}

if (typeof window !== "undefined" && !globalThis.__markaThemeInit) {
  globalThis.__markaThemeInit = true;
  apply(readMode());
  applyTransparency(readTransparency());
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

export function useTransparency(): { on: boolean; set: (v: boolean) => void } {
  const on = useSyncExternalStore(subscribeTransparency, readTransparency, () => false);
  return { on, set: setTransparency };
}

export function useTheme(): Theme {
  return useThemeMode().resolved;
}
