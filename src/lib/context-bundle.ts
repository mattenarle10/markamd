import { readMarkdown, relativePath } from "./files";
import { estimateTokens, formatTokens } from "./bundle";

export type ContextFile = {
  path: string;
  content: string;
};

export type ContextBundleStats = {
  files: number;
  tokens: number;
  formattedTokens: string;
};

export function getContextBundleStats(files: readonly ContextFile[]): ContextBundleStats {
  const tokens = estimateTokens(files.map((file) => file.content).join("\n\n"));
  return {
    files: files.length,
    tokens,
    formattedTokens: formatTokens(tokens),
  };
}

export function formatContextBundle(
  files: readonly ContextFile[],
  rootPath: string | null,
): string {
  const parts = [
    "# context bundle",
    "",
    "Files copied from marka.md for AI context.",
    "",
  ];

  for (const file of files) {
    parts.push(`<!-- file: ${relativePath(file.path, rootPath)} -->`);
    parts.push("");
    parts.push(file.content.trimEnd());
    parts.push("");
  }

  return parts.join("\n").trimEnd() + "\n";
}

export async function readContextFiles(
  paths: readonly string[],
  activePath: string | null,
  activeContent: string,
): Promise<ContextFile[]> {
  const files: ContextFile[] = [];
  for (const path of paths) {
    files.push({
      path,
      content: path === activePath ? activeContent : await readMarkdown(path),
    });
  }
  return files;
}
