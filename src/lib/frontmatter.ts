const FRONTMATTER_DELIMITER = /^---[ \t]*$/;

function lineWithoutCarriageReturn(src: string, start: number, end: number): string {
  const line = src.slice(start, end);
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

/**
 * Hide a leading YAML frontmatter block without changing source positions.
 *
 * Replacing non-newline characters with spaces keeps markdown-it token maps
 * aligned with the original document for preview-to-source selection sync.
 */
export function maskYamlFrontmatter(src: string): string {
  const firstNewline = src.indexOf("\n");
  const firstLineEnd = firstNewline === -1 ? src.length : firstNewline;
  const firstLine = lineWithoutCarriageReturn(src, 0, firstLineEnd);

  if (!FRONTMATTER_DELIMITER.test(firstLine) || firstNewline === -1) {
    return src;
  }

  let lineStart = firstNewline + 1;
  while (lineStart <= src.length) {
    const newline = src.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? src.length : newline;
    const line = lineWithoutCarriageReturn(src, lineStart, lineEnd);

    if (FRONTMATTER_DELIMITER.test(line)) {
      const frontmatterEnd = newline === -1 ? lineEnd : newline + 1;
      const masked = src.slice(0, frontmatterEnd).replace(/[^\r\n]/g, " ");
      return masked + src.slice(frontmatterEnd);
    }

    if (newline === -1) break;
    lineStart = newline + 1;
  }

  return src;
}
