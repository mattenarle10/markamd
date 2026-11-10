import { expect, test } from "bun:test";
import { getPrintStyles } from "../src/lib/pdf-export";
import { renderMermaidInHtml } from "../src/lib/mermaid";
import type { ProseFontFamily } from "../src/lib/writing-display";

const PRINT_STYLES = getPrintStyles();

test.each([
  ["inter", /"Inter"/],
  ["system", /system-ui/],
  ["mono", /monospace/],
] as const)("uses the selected %s font for printed prose", (font, family) => {
  const bodyStyles = getPrintStyles(font).match(/body\s*\{([^}]+)\}/)?.[1];
  expect(bodyStyles).toMatch(family);
  expect(getPrintStyles(font).match(/\n  code\s*\{([^}]+)\}/)?.[1]).toBe(
    PRINT_STYLES.match(/\n  code\s*\{([^}]+)\}/)?.[1],
  );
});

test("falls back to the default font for invalid persisted values", () => {
  expect(getPrintStyles('mono; } body { color: red' as ProseFontFamily)).toBe(getPrintStyles("inter"));
});

test("suppresses browser print header and footer space", () => {
  expect(PRINT_STYLES).toContain("@page { margin: 0; size: auto; }");
  expect(PRINT_STYLES).not.toContain("@page { margin: 18mm");
});

test("keeps visible document margins without a print helper note", () => {
  expect(PRINT_STYLES).toContain(".doc { max-width: none; padding: 16mm 20mm 34mm; }");
  expect(PRINT_STYLES).not.toContain(".print-note");
  expect(PRINT_STYLES).not.toContain("headers and footers");
});

test("clones document padding across printed page fragments", () => {
  expect(PRINT_STYLES).toContain("-webkit-box-decoration-break: clone;");
  expect(PRINT_STYLES).toContain("box-decoration-break: clone;");
  expect(PRINT_STYLES).toContain("body { margin: 0; padding: 0; }");
});

test("keeps mermaid html stable when no browser document is available", async () => {
  const html = '<pre class="mdv-mermaid" id="flow"><code>flowchart TD\\nA-->B</code></pre>';
  const rendered = await renderMermaidInHtml(html, "default");

  expect(rendered).toBe(html);
});
