import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { createHighlighter, type Highlighter } from "shiki";
import type { Theme } from "./theme";

// random suffix per render — mermaid id reuse across re-renders silently fails.
function mermaidId(): string {
  return `mdv-mermaid-${Math.random().toString(36).slice(2, 10)}`;
}

// shiki lazy-loads grammars; registering all here for eager load.
const LANGS = [
  // existing
  "markdown", "ts", "tsx", "js", "jsx", "json", "rust", "bash", "css", "html", "python", "go",
  // systems / compiled
  "c", "cpp", "csharp", "objective-c",
  // jvm / .net
  "java", "kotlin", "scala", "groovy",
  // mobile / swift
  "swift",
  // scripting
  "ruby", "php", "lua", "perl", "r", "elixir", "haskell",
  // data / config
  "sql", "yaml", "toml", "xml", "ini",
  // shell / devops
  "shellscript", "powershell", "dockerfile", "makefile", "nginx",
  // diff / vcs
  "diff", "git-commit",
  // misc commonly-pasted
  "graphql", "protobuf", "regex", "vim", "jsonc",
];
const THEMES = {
  latte: "catppuccin-latte",
  frappe: "catppuccin-frappe",
  macchiato: "catppuccin-macchiato",
  mocha: "catppuccin-mocha",
  matcha: "vitesse-light",
  kanagawa: "kanagawa-wave",
  "rose-pine": "rose-pine",
  ayu: "ayu-dark",
} as const;

let highlighterPromise: Promise<Highlighter> | null = null;
let highlighter: Highlighter | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: Object.values(THEMES),
      langs: LANGS,
    })
      .then((h) => {
        highlighter = h;
        return h;
      })
      .catch((err) => {
        console.error("marka.md: shiki highlighter init failed", err);
        highlighterPromise = null;
        throw err;
      });
  }
  return highlighterPromise;
}

void getHighlighter().catch(() => {
  // already logged in getHighlighter
});

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight: (code, lang) => {
    // mermaid blocks bypass shiki — Preview component renders them as svg
    if (lang === "mermaid") {
      const id = mermaidId();
      const encoded = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre class="mdv-mermaid" id="${id}"><code>${encoded}</code></pre>`;
    }
    if (!highlighter) return "";
    const loaded = highlighter.getLoadedLanguages() as readonly string[];
    const language = loaded.includes(lang) ? lang : "text";
    try {
      return highlighter.codeToHtml(code, {
        lang: language,
        // pass all themes so every variant gets a css-var; defaultColor:false uses them.
        themes: THEMES,
        defaultColor: false,
      });
    } catch {
      return "";
    }
  },
});

md.use(taskLists, { enabled: false, label: true });

export async function ensureMarkdownReady(): Promise<void> {
  await getHighlighter();
}

export function renderMarkdown(src: string, _theme: Theme): string {
  return md.render(src);
}
