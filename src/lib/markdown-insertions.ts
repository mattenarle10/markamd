export type MarkdownInsertion =
  | "table-2x2"
  | "table-3x3"
  | "unordered-list"
  | "ordered-list"
  | "code-block";

export type MarkdownInsertionResult = {
  text: string;
  selectionFrom: number;
  selectionTo: number;
};

function buildTable(columns: number, rows: number): MarkdownInsertionResult {
  const headers = Array.from({ length: columns }, (_, i) => `column ${i + 1}`);
  const divider = Array.from({ length: columns }, () => "---");
  const body = Array.from({ length: rows }, () => Array.from({ length: columns }, () => " ").join(" | "));
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...body.map((row) => `| ${row} |`),
  ];
  const text = `${lines.join("\n")}\n`;
  const firstCellStart = lines[0].length + 1 + lines[1].length + 1 + 2;
  return {
    text,
    selectionFrom: firstCellStart,
    selectionTo: firstCellStart,
  };
}

function linePrefixSelection(selection: string, formatLine: (line: string, index: number) => string): MarkdownInsertionResult {
  const lines = selection.length > 0 ? selection.split("\n") : [""];
  const text = lines.map(formatLine).join("\n");
  const cursor = text.length;
  return {
    text,
    selectionFrom: cursor,
    selectionTo: cursor,
  };
}

function codeBlock(selection: string): MarkdownInsertionResult {
  const language = "";
  const body = selection.length > 0 ? selection : "";
  const text = `\`\`\`${language}\n${body}\n\`\`\``;
  const cursor = body.length > 0 ? text.length : 4;
  return {
    text,
    selectionFrom: cursor,
    selectionTo: cursor,
  };
}

export function markdownInsertion(kind: MarkdownInsertion, selection = ""): MarkdownInsertionResult {
  switch (kind) {
    case "table-2x2":
      return buildTable(2, 2);
    case "table-3x3":
      return buildTable(3, 3);
    case "unordered-list":
      return linePrefixSelection(selection, (line) => `- ${line}`);
    case "ordered-list":
      return linePrefixSelection(selection, (line, i) => `${i + 1}. ${line}`);
    case "code-block":
      return codeBlock(selection);
  }
}
