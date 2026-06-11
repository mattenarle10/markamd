# AGENTS (marka.md)

- This repo is the marka.md desktop app: React + TypeScript + Vite frontend, Tauri v2 Rust shell.
- Keep edits scoped. Avoid broad refactors unless the task explicitly asks for structure cleanup.
- Match the existing UI style: dense, local-first, calm, keyboard-friendly, and lowercase copy where the app already uses it.
- Prefer existing primitives from `src/components/primitives` and icons from `lucide-react` through the local `Icon` wrapper.
- User-facing strings should go through `src/locales/*.json` unless the surrounding file already uses fixed product/legal copy.
- Treat this as a public OSS repo: do feature work and user-facing fixes on a branch and open a PR by default.
- Do not push directly to `main` unless Matt explicitly asks for a direct main commit/push in that turn.

## commands

- `bun test` runs focused unit tests.
- `bun run build` runs TypeScript and Vite build.
- `cargo check --manifest-path src-tauri/Cargo.toml` checks the Rust shell.
- `bun run tauri dev` starts the desktop app during UI testing.

## release/update notes

- App version is mirrored in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.lock`.
- Tauri updater artifacts are enabled in `src-tauri/tauri.conf.json`; signed release assets publish through GitHub Releases.
- Manual update UX lives in `src/hooks/use-update-flow.ts`, `src/lib/updater.ts`, command palette, Help, and About overlays.

## structure

- `src/components` contains chrome, editor, files/sidebar, overlays, and primitives.
- `src/hooks` owns stateful app flows.
- `src/lib` owns markdown, files, commands, context bundling, updater, themes, i18n, and platform helpers.
- `src/styles` is split by UI domain and imported from `src/app.css`.
- `src-tauri` contains Rust commands, capabilities, and bundle config.
