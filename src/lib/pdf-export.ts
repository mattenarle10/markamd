import { tempDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { basename, writeMarkdown } from "./files";

// Tauri 2's WKWebView no-ops window.print(). We clone the rendered preview
// article + wrap in a standalone html doc, write to OS temp, open in default
// browser. Browser auto-prints on load → user saves as PDF.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Light-theme print stylesheet. PDF is a "document" — force catppuccin-latte
// palette regardless of app theme so colors are consistent on white.
const PRINT_STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --pfg: #1d1d1f;
    --pmuted: #6e6e73;
    --paccent: #e2722e;
    --pborder: rgba(0, 0, 0, 0.08);
  }
  html, body {
    background: #fff;
    color: var(--pfg);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc { max-width: 720px; margin: 0 auto; padding: 18mm 16mm 22mm; }
  h1, h2, h3, h4 {
    font-weight: 600;
    letter-spacing: -0.018em;
    break-after: avoid;
    page-break-after: avoid;
  }
  h1 { font-size: 2.1em; margin: 0 0 0.5em; }
  h2 { font-size: 1.55em; margin: 2em 0 0.5em; }
  h3 { font-size: 1.25em; margin: 1.6em 0 0.5em; }
  h4 { font-size: 1em; margin: 1.4em 0 0.4em; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 1em; }
  p { orphans: 3; widows: 3; }
  a {
    color: var(--paccent);
    text-decoration: none;
    border-bottom: 1px solid color-mix(in srgb, var(--paccent) 30%, transparent);
  }
  code {
    font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.88em;
    background: rgba(0, 0, 0, 0.045);
    padding: 1px 6px;
    border-radius: 4px;
  }
  pre {
    font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
    font-size: 12.5px;
    line-height: 1.55;
    background: #fafafa;
    border: 1px solid var(--pborder);
    border-radius: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  blockquote, table, .mdv-mermaid {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  img { max-width: 100%; height: auto; border-radius: 6px; break-inside: avoid; }
  pre code { background: transparent; padding: 0; font-size: inherit; border-radius: 0; }
  pre.shiki, pre.shiki * { font-family: inherit; }
  /* shiki spans carry --shiki-{theme} vars inline; pick latte for print. */
  .shiki, .shiki span {
    background-color: transparent !important;
    color: var(--shiki-latte) !important;
    font-style: var(--shiki-latte-font-style, inherit) !important;
    font-weight: var(--shiki-latte-font-weight, inherit) !important;
    text-decoration: var(--shiki-latte-text-decoration, inherit) !important;
  }
  blockquote {
    border-left: 3px solid var(--paccent);
    padding-left: 16px;
    color: var(--pmuted);
    font-style: italic;
  }
  hr { border: none; border-top: 1px solid var(--pborder); margin: 2em 0; }
  ul, ol { padding-left: 24px; }
  li { margin: 0.25em 0; }
  .task-list-item { list-style: none; margin-left: -1.4em; }
  .task-list-item input[type="checkbox"] {
    margin-right: 0.5em;
    accent-color: var(--paccent);
    width: 0.95em;
    height: 0.95em;
    vertical-align: -0.1em;
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid var(--pborder); padding: 8px 12px; text-align: left; vertical-align: top; }
  th { background: rgba(0, 0, 0, 0.03); font-weight: 600; }
  .mdv-mermaid { background: transparent; border: 0; padding: 0; text-align: center; }
  .mdv-mermaid svg { max-width: 100%; height: auto; }
  .mdv-copy, .mdv-codeblock > .mdv-copy { display: none !important; }
  /* margin:0 on @page suppresses browser auto-header/footer. .doc padding holds visible margin. */
  @page { margin: 0; size: auto; }
  @media print {
    body { padding: 0; }
    .doc { padding: 18mm 16mm 22mm; }
  }
`;

export class PdfExportError extends Error {
  constructor(
    public readonly code: "empty" | "no-preview" | "io",
    message: string,
  ) {
    super(message);
    this.name = "PdfExportError";
  }
}

type ExportOpts = {
  source: string;
  activePath: string | null;
};

/** Export the live .mdv-prose article as a self-contained HTML and open in browser to print. */
export async function exportPreviewToPdf({ source, activePath }: ExportOpts): Promise<void> {
  if (!source.trim()) {
    throw new PdfExportError("empty", "nothing to export. open or write some markdown first.");
  }
  const article = document.querySelector<HTMLElement>(".mdv-prose");
  if (!article) {
    throw new PdfExportError("no-preview", "preview isn't rendered yet. try again in a moment.");
  }

  const fileName = activePath ? basename(activePath) : undefined;
  const title = fileName ?? "marka.md export";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <main class="doc">
    ${article.outerHTML}
  </main>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 350);
    });
  </script>
</body>
</html>`;

  try {
    const dir = (await tempDir()).replace(/[\\/]+$/, "");
    const safeName = (fileName ?? "export")
      .replace(/\.md$/i, "")
      .replace(/[^\w.-]+/g, "-")
      .slice(0, 60) || "export";
    const tempPath = `${dir}/marka-${safeName}.html`;
    await writeMarkdown(tempPath, html);
    await openPath(tempPath);
  } catch {
    throw new PdfExportError("io", "couldn't export to pdf — try again, or check disk space");
  }
}
