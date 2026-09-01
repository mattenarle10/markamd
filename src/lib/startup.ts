export const STARTUP_MODES = ["welcome", "blank"] as const;

export type StartupMode = (typeof STARTUP_MODES)[number];

export const DEFAULT_STARTUP_MODE: StartupMode = "welcome";

export function normalizeStartupMode(value: unknown): StartupMode {
  return value === "blank" ? "blank" : DEFAULT_STARTUP_MODE;
}
