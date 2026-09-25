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

test("renders <br> tags as line breaks inside table cells", async () => {
  const source = [
    "| name | desc |",
    "| --- | --- |",
    "| code | 0=success<br>other=failed<br/>x<br />y |",
  ].join("\n");

  const html = await renderMarkdown(source, "latte");

  expect(html).toContain("<td>0=success<br>\nother=failed<br>\nx<br>\ny</td>");
});

test("keeps other raw html escaped", async () => {
  const html = await renderMarkdown("a<br>b <script>alert(1)</script> <br onclick=x>", "latte");

  expect(html).toContain("a<br>\nb");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;br onclick=x&gt;");
});
