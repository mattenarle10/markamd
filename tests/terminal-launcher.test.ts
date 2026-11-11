import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "marka-cli-test-")));
  roots.push(root);
  const app = join(root, "marka space.app");
  const cli = join(app, "Contents/Resources/cli");
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(app, "Contents/Info.plist"), '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>1.7.11</string></dict></plist>');
  const log = join(root, "args.json");
  const mock = join(root, "open-mock");
  writeFileSync(mock, `#!/bin/sh\nprintf '%s\\n' "$@" > '${log}'\ncase "$*" in *--wait-open*)\n  while [ "$1" != --wait-open ]; do shift; done\n  printf '%s' "\${MOCK_RESULT:-closed}" > "$2"\n;; esac\nexit "\${MOCK_EXIT:-0}"\n`, { mode: 0o755 });
  // Replace the OS transport only. Run the real shipped parser and path logic.
  const source = readFileSync(new URL("../src-tauri/cli/marka", import.meta.url), "utf8");
  writeFileSync(join(cli, "marka"), source.replaceAll("/usr/bin/open", `'${mock}'`), { mode: 0o755 });
  const command = join(root, "marka");
  symlinkSync(join(cli, "marka"), command);
  const file = join(root, "review 日本語.md");
  writeFileSync(file, "# Review");
  const run = (args: string[], env: Record<string, string> = {}) => {
    const p = Bun.spawnSync([command, ...args], { cwd: root, env: { ...process.env, ...env } });
    return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
  };
  return { root, app, log, file, command, run };
}

test("launcher shows help and version without launching the GUI", () => {
  const { run } = fixture();
  expect(run([]).out).toContain("marka open");
  expect(run(["--help"]).code).toBe(0);
  expect(run(["--version"]).out.trim()).toBe("1.7.11");
});

test("launcher preserves quoted Unicode paths and resolves relative paths", () => {
  const f = fixture();
  expect(f.run(["open", "review 日本語.md"]).code).toBe(0);
  expect(readFileSync(f.log, "utf8").trim().split("\n")).toEqual(["-a", f.app, f.file]);
});

test("launcher supports -- before a leading-dash filename", () => {
  const f = fixture();
  writeFileSync(join(f.root, "-review.MD"), "# Note");
  expect(f.run(["open", "-review.MD"]).code).toBe(2);
  expect(f.run(["open", "--", "-review.MD"]).code).toBe(0);
});

test("launcher rejects missing, unsupported, directory and multiple inputs", () => {
  const f = fixture();
  writeFileSync(join(f.root, "file.txt"), "text");
  for (const args of [["open"], ["open", "missing.md"], ["open", "file.txt"], ["open", f.root], ["open", f.file, f.file], ["oops"]]) {
    expect(f.run(args).code).toBe(2);
  }
});

test("launcher propagates OS launch failures", () => {
  const f = fixture();
  expect(f.run(["open", f.file], { MOCK_EXIT: "1" }).code).toBe(1);
});

test("wait releases on close and reports failed open or app crash", () => {
  const f = fixture();
  expect(f.run(["open", "--wait", f.file]).code).toBe(0);
  expect(f.run(["open", "--wait", f.file], { MOCK_RESULT: "failed" }).code).toBe(1);
  expect(f.run(["open", "--wait", f.file], { MOCK_RESULT: "opened:99999999" }).code).toBe(1);
});

test("wait persists while open, then cleans up only its own session", async () => {
  const f = fixture();
  const child = Bun.spawn([f.command, "open", "--wait", f.file], {
    env: { ...process.env, MOCK_RESULT: `opened:${process.pid}` }, stdout: "pipe", stderr: "pipe",
  });
  let marker = "";
  for (let i = 0; i < 100; i++) {
    try { const args = readFileSync(f.log, "utf8").trim().split("\n"); marker = args[args.indexOf("--wait-open") + 1]; if (marker) break; } catch {}
    await Bun.sleep(10);
  }
  expect(marker).toContain("marka-wait.");
  await Bun.sleep(300);
  expect(child.exitCode).toBeNull();
  writeFileSync(f.file, "# Saved");
  await Bun.sleep(250);
  expect(child.exitCode).toBeNull();
  writeFileSync(marker, "closed");
  expect(await child.exited).toBe(0);
  expect(await Bun.file(marker).exists()).toBe(false);
});

test("Ctrl-C cancels a wait and cleans its marker", async () => {
  const f = fixture();
  const child = Bun.spawn([f.command, "open", "--wait", f.file], {
    env: { ...process.env, MOCK_RESULT: `opened:${process.pid}` }, stdout: "pipe", stderr: "pipe",
  });
  let marker = "";
  for (let i = 0; i < 100; i++) {
    try { const args = readFileSync(f.log, "utf8").trim().split("\n"); marker = args[args.indexOf("--wait-open") + 1]; if (marker) break; } catch {}
    await Bun.sleep(10);
  }
  expect(marker).toContain("marka-wait.");
  child.kill("SIGINT");
  expect(await child.exited).toBe(130);
  expect(await Bun.file(marker).exists()).toBe(false);
  expect(readFileSync(f.file, "utf8")).toBe("# Review");
});
