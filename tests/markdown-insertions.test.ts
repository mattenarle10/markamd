import { expect, test } from "bun:test";
import { markdownInsertion } from "../src/lib/markdown-insertions";

test("builds a 2x2 markdown table", () => {
  expect(markdownInsertion("table-2x2").text).toBe([
    "| column 1 | column 2 |",
    "| --- | --- |",
    "|   |   |",
    "|   |   |",
    "",
  ].join("\n"));
});

test("builds a 3x3 markdown table", () => {
  expect(markdownInsertion("table-3x3").text).toBe([
    "| column 1 | column 2 | column 3 |",
    "| --- | --- | --- |",
    "|   |   |   |",
    "|   |   |   |",
    "|   |   |   |",
    "",
  ].join("\n"));
});

test("wraps selected lines as an unordered list", () => {
  expect(markdownInsertion("unordered-list", "alpha\nbeta").text).toBe("- alpha\n- beta");
});

test("wraps selected lines as an ordered list", () => {
  expect(markdownInsertion("ordered-list", "alpha\nbeta").text).toBe("1. alpha\n2. beta");
});

test("wraps selected text in a fenced code block", () => {
  expect(markdownInsertion("code-block", "const x = 1;").text).toBe("```\nconst x = 1;\n```");
});

test("places the empty code block cursor inside the fence", () => {
  const insertion = markdownInsertion("code-block");

  expect(insertion.text).toBe("```\n\n```");
  expect(insertion.selectionFrom).toBe(4);
  expect(insertion.selectionTo).toBe(4);
});
