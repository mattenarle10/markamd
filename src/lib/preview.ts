/**
 * File quick-preview classification.
 *
 * The sidebar opens `.md/.markdown/.mdx/.csv` in the editor; every other file
 * goes through the preview overlay. `previewKindForPath` decides which renderer
 * the overlay uses (`.html/.htm` render in a sandboxed iframe with a `<base>`
 * pointing at the file's directory via the asset protocol). Mime values are
 * webview-native (no parsing library) so the overlay can build blob/data URLs
 * straight from `readFile` bytes.
 */

export type PreviewKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "html"
  | "office"
  | "text"
  | "unsupported";

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  ico: "image/x-icon",
};

const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
};

const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
};

/** Office/binary document formats we can't render inline without a parser. */
const OFFICE_EXT = new Set([
  "doc",
  "docx",
  "docm",
  "dotx",
  "xls",
  "xlsx",
  "xlsm",
  "xlsb",
  "ppt",
  "pptx",
  "pptm",
  "odt",
  "ods",
  "odp",
  "key",
  "pages",
  "numbers",
  "rtf",
  "epub",
]);

/** Plain-text / code extensions previewed read-only. */
const TEXT_EXT = new Set([
  "txt",
  "text",
  "log",
  "json",
  "json5",
  "jsonc",
  "ndjson",
  "yml",
  "yaml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "properties",
  "env",
  "xml",
  "css",
  "scss",
  "less",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "vue",
  "svelte",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "cs",
  "php",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "sql",
  "graphql",
  "gql",
  "diff",
  "patch",
  "lua",
  "r",
  "swift",
  "dart",
  "proto",
]);

/** Extensionless filenames that are effectively text. */
const TEXT_BASENAMES = new Set([
  "readme",
  "license",
  "licence",
  "changelog",
  "authors",
  "contributors",
  "makefile",
  "dockerfile",
  "rakefile",
  "gemfile",
  "procfile",
  "vagrantfile",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".env",
  ".npmrc",
  ".prettierrc",
  ".eslintrc",
]);

function basenameLower(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return path.slice(i + 1).toLowerCase();
}

function extOf(path: string): string {
  const base = basenameLower(path);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1) : "";
}

export function previewKindForPath(path: string): PreviewKind {
  const ext = extOf(path);
  if (IMAGE_MIME[ext]) return "image";
  if (VIDEO_MIME[ext]) return "video";
  if (AUDIO_MIME[ext]) return "audio";
  if (ext === "pdf") return "pdf";
  if (ext === "html" || ext === "htm") return "html";
  if (OFFICE_EXT.has(ext)) return "office";
  if (TEXT_EXT.has(ext)) return "text";
  if (TEXT_BASENAMES.has(basenameLower(path))) return "text";
  return "unsupported";
}

/** Mime for the binary kinds the overlay embeds (image/video/audio/pdf). "" for non-binary kinds. */
export function previewMimeForPath(path: string): string {
  const ext = extOf(path);
  if (ext === "pdf") return "application/pdf";
  return IMAGE_MIME[ext] ?? VIDEO_MIME[ext] ?? AUDIO_MIME[ext] ?? "";
}

/**
 * Inject a `<base href>` into an html document so the previewed file resolves
 * relative resources (images, css, scripts) against its own directory.
 * `baseHref` is a `convertFileSrc()` asset URL of that directory. An existing
 * `<base>` in the document would lose (the first one wins), so local files
 * keep working.
 */
export function htmlDocWithBase(html: string, baseHref: string): string {
  const href = baseHref.endsWith("/") ? baseHref : `${baseHref}/`;
  const base = `<base href="${href.replace(/"/g, "&quot;")}">`;
  const head = /<head[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + base + html.slice(at);
  }
  return base + html;
}
