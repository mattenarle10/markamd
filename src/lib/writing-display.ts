export type WritingFontSize = "small" | "default" | "large" | "x-large";
export type WritingLineHeight = "compact" | "comfortable" | "airy";
export type ReadingFontSize = "small" | "default" | "large" | "x-large";
export type ReadingWidth = "narrow" | "comfortable" | "wide" | "full";
export type ProseFontFamily = "inter" | "system" | "mono";

export type WritingDisplay = {
  fontSize: WritingFontSize;
  lineHeight: WritingLineHeight;
  readingFontSize: ReadingFontSize;
  readingWidth: ReadingWidth;
  proseFontFamily: ProseFontFamily;
};

export const DEFAULT_WRITING_DISPLAY: WritingDisplay = {
  fontSize: "default",
  lineHeight: "comfortable",
  readingFontSize: "default",
  readingWidth: "comfortable",
  proseFontFamily: "inter",
};

export const WRITING_FONT_SIZE_OPTIONS: WritingFontSize[] = ["small", "default", "large", "x-large"];
export const WRITING_LINE_HEIGHT_OPTIONS: WritingLineHeight[] = ["compact", "comfortable", "airy"];
export const READING_FONT_SIZE_OPTIONS: ReadingFontSize[] = ["small", "default", "large", "x-large"];
export const READING_WIDTH_OPTIONS: ReadingWidth[] = ["narrow", "comfortable", "wide", "full"];
export const PROSE_FONT_FAMILY_OPTIONS: ProseFontFamily[] = ["inter", "system", "mono"];

const EDITOR_FONT_VALUES: Record<WritingFontSize, string> = {
  small: "13px",
  default: "14px",
  large: "16px",
  "x-large": "18px",
};

const PROSE_FONT_VALUES: Record<WritingFontSize, string> = {
  small: "14px",
  default: "15px",
  large: "17px",
  "x-large": "19px",
};

const READING_FONT_VALUES: Record<ReadingFontSize, string> = {
  small: "15px",
  default: "16px",
  large: "18px",
  "x-large": "20px",
};

const EDITOR_LINE_HEIGHT_VALUES: Record<WritingLineHeight, string> = {
  compact: "1.45",
  comfortable: "1.55",
  airy: "1.75",
};

const PROSE_LINE_HEIGHT_VALUES: Record<WritingLineHeight, string> = {
  compact: "1.55",
  comfortable: "1.65",
  airy: "1.8",
};

const READING_WIDTH_VALUES: Record<ReadingWidth, { content: string; prose: string }> = {
  narrow: { content: "760px", prose: "620px" },
  comfortable: { content: "880px", prose: "720px" },
  wide: { content: "1080px", prose: "880px" },
  full: { content: "1360px", prose: "1120px" },
};

const PROSE_FONT_FAMILY_VALUES: Record<ProseFontFamily, string> = {
  inter: "var(--font-ui)",
  system: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  mono: "var(--font-mono)",
};

function normalizeOption<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

export function normalizeWritingFontSize(value: unknown): WritingFontSize {
  return normalizeOption(value, WRITING_FONT_SIZE_OPTIONS, DEFAULT_WRITING_DISPLAY.fontSize);
}

export function normalizeWritingLineHeight(value: unknown): WritingLineHeight {
  return normalizeOption(value, WRITING_LINE_HEIGHT_OPTIONS, DEFAULT_WRITING_DISPLAY.lineHeight);
}

export function normalizeReadingFontSize(value: unknown): ReadingFontSize {
  return normalizeOption(value, READING_FONT_SIZE_OPTIONS, DEFAULT_WRITING_DISPLAY.readingFontSize);
}

export function normalizeReadingWidth(value: unknown): ReadingWidth {
  return normalizeOption(value, READING_WIDTH_OPTIONS, DEFAULT_WRITING_DISPLAY.readingWidth);
}

export function normalizeProseFontFamily(value: unknown): ProseFontFamily {
  return normalizeOption(value, PROSE_FONT_FAMILY_OPTIONS, DEFAULT_WRITING_DISPLAY.proseFontFamily);
}

export function getWritingDisplayVars(display: WritingDisplay): Record<string, string> {
  const readingWidth = READING_WIDTH_VALUES[display.readingWidth];
  return {
    "--mdv-writing-font-size": EDITOR_FONT_VALUES[display.fontSize],
    "--mdv-writing-line-height": EDITOR_LINE_HEIGHT_VALUES[display.lineHeight],
    "--mdv-prose-font-size": PROSE_FONT_VALUES[display.fontSize],
    "--mdv-prose-line-height": PROSE_LINE_HEIGHT_VALUES[display.lineHeight],
    "--mdv-prose-font-family": PROSE_FONT_FAMILY_VALUES[display.proseFontFamily],
    "--mdv-reading-font-size": READING_FONT_VALUES[display.readingFontSize],
    "--mdv-reading-content-width": readingWidth.content,
    "--mdv-reading-prose-width": readingWidth.prose,
  };
}
