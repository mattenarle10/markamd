import { expect, test } from "bun:test";
import { renderMarkdown } from "../src/lib/markdown";

test("hides leading YAML frontmatter and preserves source line mapping", async () => {
  const source = [
    "---",
    "created: 2026-07-27",
    "updated: 2026-07-31",
    "type: reference",
    "status: complete",
    "tags: [workbook, principles, defaults]",
    "---",
    "",
    "# Your Context Block: your defaults",
    "",
    "Body text here.",
  ].join("\n");

  const html = await renderMarkdown(source, "latte");

  expect(html).not.toContain("created: 2026-07-27");
  expect(html).not.toContain("<hr");
  expect(html).toContain(
    '<h1 data-sline="8" data-eline="9" id="your-context-block-your-defaults">',
  );
  expect(html).toContain("Body text here.");
});

test("keeps thematic breaks outside leading frontmatter", async () => {
  const html = await renderMarkdown("# Heading\n\n---\n\nBody", "latte");

  expect(html).toContain('<hr data-sline="2" data-eline="3">');
});

test("leaves an unterminated opening delimiter as ordinary markdown", async () => {
  const html = await renderMarkdown("---\nkey: value\n# Heading", "latte");

  expect(html).toContain("<hr");
  expect(html).toContain("key: value");
});
