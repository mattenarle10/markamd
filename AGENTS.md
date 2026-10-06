# AGENTS (marka.md)

- This repo is the marka.md desktop app: React + TypeScript + Vite frontend, Tauri v2 Rust shell.
- Keep edits scoped. Avoid broad refactors unless the task explicitly asks for structure cleanup.
- Match the existing UI style: dense, local-first, calm, keyboard-friendly, and lowercase copy where the app already uses it.
- Prefer existing primitives from `src/components/primitives` and icons from `lucide-react` through the local `Icon` wrapper.
- User-facing strings should go through `src/locales/*.json` unless the surrounding file already uses fixed product/legal copy.

## publishing boundary

- Do not commit or push internal planning notes, stale issue queues, private todo lists, or agent scratch docs to the public OSS repo.
- If the user asks to "note", "track", or "add to stale docs" without explicitly saying to publish it, keep it in chat or ask where the private note should live.
- Only update public docs (`README.md`, `docs/**`, release notes, tutorials, site copy) when the content is meant for users/contributors or the user explicitly asks to publish it.

## commands

- `bun test` runs focused unit tests.
- `bun run build` runs TypeScript and Vite build.
- `cargo check --manifest-path src-tauri/Cargo.toml` checks the Rust shell.
- `cargo check --release --manifest-path src-tauri/Cargo.toml` checks the release profile used by CI.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` checks Rust formatting without changing files.
- `bun run tauri dev` starts the desktop app during UI testing.

## local github workflow

- Keep the primary checkout available for the user's work. For branch, PR, and release work, use a separate worktree off `origin/main` (for example `git worktree add /private/tmp/markamd-main origin/main`) and remove it when the work is merged.
- Start feature work from the current local `main` branch, keep one focused branch, and run the app from that checkout so screenshots test the branch being changed.
- If another dev server occupies port `1420`, run Tauri with a temporary port override, for example `bun run tauri dev --config '{"build":{"beforeDevCommand":"bun run dev -- --port 1421","devUrl":"http://localhost:1421"}}'`.
- Dependabot may re-resolve to a newer version when it rebases. After merging a `tauri` crate bump, run `bun run tauri build --no-bundle`; CI does not catch a mismatch between the crate and `@tauri-apps/api` / `@tauri-apps/cli`.
- Before merging, verify the PR author and GitHub account are `mattenarle10`, inspect comments and reviews, and wait for both `typecheck` and `rust-check` to pass.
- For a release, merge a version-bump PR first, tag the exact merged `origin/main` commit, and watch the tag's `release` workflow through publication. Confirm the GitHub release is public and latest with signed platform assets and `latest.json`.
- Check `https://markamd.vercel.app/` and `/changelog/` after publishing. The site fetches release data at build time; if it is stale, use the site repository's normal Vercel deploy path rather than changing app release metadata.

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
