import { expect, test } from "bun:test";
import {
  DEFAULT_WRITING_DISPLAY,
  getWritingDisplayVars,
  normalizeProseFontFamily,
  normalizeReadingFontSize,
  normalizeReadingWidth,
} from "../src/lib/writing-display";

test("normalizes new display options back to defaults", () => {
  expect(normalizeReadingFontSize("huge")).toBe(DEFAULT_WRITING_DISPLAY.readingFontSize);
  expect(normalizeReadingWidth("book")).toBe(DEFAULT_WRITING_DISPLAY.readingWidth);
  expect(normalizeProseFontFamily("serif")).toBe(DEFAULT_WRITING_DISPLAY.proseFontFamily);
});

test("emits reading display css variables", () => {
  const vars = getWritingDisplayVars({
    ...DEFAULT_WRITING_DISPLAY,
    readingFontSize: "large",
    readingWidth: "wide",
    proseFontFamily: "mono",
  });

  expect(vars["--mdv-reading-font-size"]).toBe("18px");
  expect(vars["--mdv-reading-content-width"]).toBe("1080px");
  expect(vars["--mdv-reading-prose-width"]).toBe("880px");
  expect(vars["--mdv-prose-font-family"]).toBe("var(--font-mono)");
});
