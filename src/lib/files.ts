import { open, save } from "@tauri-apps/plugin-dialog";
import { readDir, readFile, readTextFile, writeTextFile, exists, stat, rename, mkdir, remove } from "@tauri-apps/plugin-fs";

export type FileEntry = {
  name: string;
  path: string;
  isDir: boolean;
};

export async function pickFolder(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: "open folder",
  });
  if (typeof result === "string") return result;
  return null;
}

export async function pickMarkdownFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    title: "open markdown",
    filters: [{ name: "markdown", extensions: ["md", "markdown", "mdx"] }],
  });
  if (typeof result === "string") return result;
  return null;
}

/**
 * Native "Save As" dialog. Returns the chosen path or null on cancel.
 * Used when the current buffer has no `activePath` yet (new untitled file)
 * or when user explicitly wants to save-as to a new location.
 */
export async function pickSaveMarkdown(defaultPath?: string): Promise<string | null> {
  const result = await save({
    title: "save markdown",
    defaultPath,
    filters: [{ name: "markdown", extensions: ["md", "markdown", "mdx"] }],
  });
  return result ?? null;
}

const MARKDOWN_EXT = /\.(md|markdown|mdx)$/i;

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXT.test(path);
}

export function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : "/";
}

export function joinPath(parent: string, child: string): string {
  const sep = parent.includes("\\") ? "\\" : "/";
  if (parent.endsWith(sep)) return `${parent}${child}`;
  return `${parent}${sep}${child}`;
}

export async function listFolder(path: string): Promise<FileEntry[]> {
  const entries = await readDir(path);
  return entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => ({
      name: e.name,
      path: joinPath(path, e.name),
      isDir: e.isDirectory,
    }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export type FlatFileEntry = {
  name: string;
  path: string;
  /** path relative to the walk root, for display ("notes/ideas.md") */
  rel: string;
};

const WALK_SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".next",
  ".vercel",
  ".cache",
]);

const WALK_MAX_FILES = 5000;

export async function walkMarkdownFiles(root: string): Promise<FlatFileEntry[]> {
  const out: FlatFileEntry[] = [];
  const sep = root.includes("\\") ? "\\" : "/";

  async function visit(dir: string, relPrefix: string) {
    if (out.length >= WALK_MAX_FILES) return;
    let entries: Awaited<ReturnType<typeof readDir>>;
    try {
      entries = await readDir(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= WALK_MAX_FILES) return;
      if (e.name.startsWith(".")) continue;
      if (e.isDirectory && WALK_SKIP.has(e.name)) continue;
      const childPath = joinPath(dir, e.name);
      const childRel = relPrefix ? `${relPrefix}${sep}${e.name}` : e.name;
      if (e.isDirectory) {
        await visit(childPath, childRel);
      } else if (isMarkdownPath(e.name)) {
        out.push({ name: e.name, path: childPath, rel: childRel });
      }
    }
  }

  await visit(root, "");
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return out;
}

const MAX_MARKDOWN_BYTES = 5 * 1024 * 1024; // 5MB sanity cap

const BINARY_SIGNATURES: Array<{ bytes: number[]; label: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], label: "pdf" }, // %PDF
  { bytes: [0xff, 0xd8, 0xff], label: "jpeg image" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], label: "png image" },
  { bytes: [0x47, 0x49, 0x46, 0x38], label: "gif image" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], label: "zip / docx / xlsx" },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: "elf binary" },
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], label: "mach-o binary" },
];

export type FileValidation =
  | { ok: true }
  | { ok: false; reason: string };

/** Quick guard before reading a file as markdown. Catches PDFs, images, oversized files. */
export async function validateMarkdownFile(path: string): Promise<FileValidation> {
  if (!isMarkdownPath(path)) {
    return { ok: false, reason: `${basename(path)} isn't a markdown file. marka.md handles .md / .markdown / .mdx` };
  }
  try {
    const info = await stat(path);
    if (info.size > MAX_MARKDOWN_BYTES) {
      const mb = (info.size / (1024 * 1024)).toFixed(1);
      return { ok: false, reason: `${basename(path)} is ${mb} MB — too big to render safely. Open smaller .md files.` };
    }
    const head = await readFile(path);
    const slice = head.slice(0, 8);
    for (const sig of BINARY_SIGNATURES) {
      if (sig.bytes.every((b, i) => slice[i] === b)) {
        return { ok: false, reason: `${basename(path)} looks like a ${sig.label}. marka.md only opens plain-text markdown.` };
      }
    }
  } catch (err) {
    return { ok: false, reason: `could not read ${basename(path)} — ${err}` };
  }
  return { ok: true };
}

export async function readMarkdown(path: string): Promise<string> {
  return readTextFile(path);
}

export async function writeMarkdown(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

/** Thrown when a destination path already exists. Callers should surface a friendly toast. */
export const FS_CONFLICT = "FS_CONFLICT";

/** Move a file or folder into `dstParent`. Preserves the source basename. */
export async function moveEntry(src: string, dstParent: string): Promise<string> {
  const target = joinPath(dstParent, basename(src));
  if (target === src) return src;
  if (await pathExists(target)) throw new Error(FS_CONFLICT);
  await rename(src, target);
  return target;
}

/** Rename in place (same parent folder). `newName` is just the base name. */
export async function renameEntry(src: string, newName: string): Promise<string> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("empty name");
  const target = joinPath(dirname(src), trimmed);
  if (target === src) return src;
  if (await pathExists(target)) throw new Error(FS_CONFLICT);
  await rename(src, target);
  return target;
}

export async function createFolder(parent: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("empty name");
  const target = joinPath(parent, trimmed);
  if (await pathExists(target)) throw new Error(FS_CONFLICT);
  await mkdir(target, { recursive: false });
  return target;
}

export async function createMarkdownFile(parent: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("empty name");
  const withExt = /\.(md|markdown|mdx)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
  const target = joinPath(parent, withExt);
  if (await pathExists(target)) throw new Error(FS_CONFLICT);
  await writeTextFile(target, "");
  return target;
}

/** Permanently delete a file or empty folder. Used by undo of "create" ops. */
export async function removeEntry(path: string, isDir: boolean): Promise<void> {
  await remove(path, isDir ? { recursive: false } : undefined);
}
