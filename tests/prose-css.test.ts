import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const proseCss = readFileSync(new URL("../src/styles/editor/prose.css", import.meta.url), "utf8");

test("keeps fenced code blocks on one line and scrollable", () => {
  const block = proseCss.match(/\.mdv-prose pre\s*\{[^}]*\}/s)?.[0] ?? "";

  expect(block).toContain("overflow-x: auto;");
  expect(block).toContain("white-space: pre;");
  expect(block).toContain("overflow-wrap: normal;");
});
