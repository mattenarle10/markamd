import { afterEach, expect, mock, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { exportPreviewToPdf } from "../src/lib/pdf-export";

// Vite supplies the embedded font assets; the browser checks exercise those.
mock.module("../src/lib/pdf-fonts", () => ({ getPrintFontFaces: () => "/* embedded fonts */" }));

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");

afterEach(() => {
  for (const [name, descriptor] of [["window", originalWindow], ["document", originalDocument], ["crypto", originalCrypto]] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

function setupExport(failure?: "write" | "open") {
  const writes = new Map<string, string>();
  const opened: string[] = [];
  const invoke = mock(async (command: string, args: unknown, options?: { headers: { path: string } }) => {
    if (command === "plugin:path|resolve_directory") return "/private/tmp/";
    if (command === "plugin:fs|write_text_file") {
      if (failure === "write") throw new Error("disk full");
      writes.set(decodeURIComponent(options!.headers.path), new TextDecoder().decode(args as Uint8Array));
      return;
    }
    if (command === "plugin:opener|open_path") {
      if (failure === "open") throw new Error("no browser available");
      opened.push((args as { path: string }).path);
      return;
    }
    throw new Error(`unexpected native command: ${command}`);
  });

  Object.defineProperty(globalThis, "window", { configurable: true, value: { __TAURI_INTERNALS__: { invoke } } });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        className: "", dataset: {}, innerHTML: "", children: [],
        ownerDocument: { defaultView: null },
        setAttribute: () => {},
        querySelectorAll: () => [],
        get outerHTML() { return `<article>${this.innerHTML}</article>`; },
      }),
    },
  });
  return { writes, opened, invoke };
}

test("keeps concurrent exports with identical filenames independent", async () => {
  const { writes, opened } = setupExport();
  // WebViews without secure-context UUID support still provide getRandomValues.
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues } });
  await Promise.all([
    exportPreviewToPdf({ source: "# First document", activePath: "/first/report.md", proseFontFamily: "mono" }),
    exportPreviewToPdf({ source: "# Second document", activePath: "/second/report.md", proseFontFamily: "system" }),
    exportPreviewToPdf({ source: "# Third document", activePath: "/first/report.md" }),
  ]);

  expect(writes.size).toBe(3);
  expect(new Set(opened).size).toBe(3);
  expect(opened.every((path) => writes.has(path))).toBe(true);
  const documents = [...writes.values()];
  expect(documents.filter((html) => html.includes("First document"))).toHaveLength(1);
  expect(documents.filter((html) => html.includes("Second document"))).toHaveLength(1);
  expect(documents.filter((html) => html.includes("Third document"))).toHaveLength(1);
  expect(documents.find((html) => html.includes("First document"))).toContain('font-family: "JetBrains Mono"');
  expect(documents.every((html) => html.includes("<title>report</title>"))).toBe(true);
});

test("waits for fonts before opening the browser print dialog", async () => {
  const { writes } = setupExport();
  await exportPreviewToPdf({ source: "# Print readiness", activePath: null });
  const script = [...writes.values()][0]!.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  let onLoad: (() => Promise<void>) | undefined;
  let finishFonts!: () => void;
  const ready = new Promise<void>((resolve) => { finishFonts = resolve; });
  const print = mock(() => {});
  runInNewContext(script, {
    window: { addEventListener: (_event: string, callback: () => Promise<void>) => { onLoad = callback; }, print },
    document: { fonts: { ready } },
    setTimeout: (callback: () => void) => callback(),
  });

  const loading = onLoad!();
  await Promise.resolve();
  expect(print).not.toHaveBeenCalled();
  finishFonts();
  await loading;
  expect(print).toHaveBeenCalledTimes(1);
});

test("rejects empty documents before native IO", async () => {
  const { invoke } = setupExport();
  await expect(exportPreviewToPdf({ source: " \n ", activePath: null })).rejects.toMatchObject({ code: "empty" });
  expect(invoke).not.toHaveBeenCalled();
});

test.each(["write", "open"] as const)("reports %s failures as export IO errors", async (failure) => {
  setupExport(failure);
  await expect(exportPreviewToPdf({ source: "# Document", activePath: null })).rejects.toMatchObject({ code: "io" });
});
