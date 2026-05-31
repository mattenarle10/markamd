<p align="center">
  <img src="./assets/readme-icon.png" width="180" alt="marka.md app icon" />
</p>

<h1 align="center">marka.md</h1>

<p align="center"><em>a local markdown editor for the notes you share with ai.</em></p>

<p align="center">
  <a href="https://markamd.vercel.app"><img src="https://img.shields.io/badge/site-markamd.vercel.app-orange?style=flat-square" alt="site" /></a>
  <a href="https://github.com/mattenarle10/markamd/releases/latest"><img src="https://img.shields.io/github/v/release/mattenarle10/markamd?style=flat-square&color=orange&label=release" alt="release" /></a>
  <a href="https://github.com/mattenarle10/markamd/releases"><img src="https://img.shields.io/github/downloads/mattenarle10/markamd/total?style=flat-square&color=black&label=downloads" alt="downloads" /></a>
  <a href="https://github.com/mattenarle10/markamd/stargazers"><img src="https://img.shields.io/github/stars/mattenarle10/markamd?style=flat-square&color=black&label=stars" alt="stars" /></a>
  <img src="https://img.shields.io/badge/macOS-13%2B-black?style=flat-square" alt="macos" />
  <img src="https://img.shields.io/badge/Windows-10%2B-black?style=flat-square" alt="windows" />
  <img src="https://img.shields.io/badge/Linux-x86__64-black?style=flat-square" alt="linux" />
  <img src="https://img.shields.io/badge/license-MIT-black?style=flat-square" alt="mit" />
  <img src="https://img.shields.io/badge/notarized-Apple%20Developer-orange?style=flat-square" alt="notarized" />
</p>

a cross-platform (**macOS · Windows · Linux**) markdown editor specialized for **ai context management**. live editor, rendered preview, file tabs, csv preview, grouped themes, and a context tray for staging multiple notes into one AI-ready bundle.

> built around one loop: **collect notes → write → share with ai**. nothing leaves your machine until you copy.

works with claude, chatgpt, gemini, local agents, and anything that reads plain markdown.

## features

- **live preview** — fast markdown rendering, shiki code highlighting, mermaid diagrams
- **file tabs** — keep multiple notes open and switch quickly
- **csv preview** — open `.csv` files as a capped, read-only table for quick data checks beside your notes
- **grouped themes** — mono, catppuccin, crafted palettes, plus Claude / Codex / Gemini / Cursor-inspired themes
- **reading mode** — ⌘. distraction-free preview with iA-style typography
- **editor-only mode** — ⌘⇧. hide the preview when you want to focus on writing
- **vim mode** — opt-in via the theme menu
- **find** — ⌘f works in BOTH editor (codemirror) and reading mode (text-node walker w/ live highlights)
- **command palette** — ⌘k, fuzzy + grouped
- **ide-style sidebar** — drag-to-move, right-click rename / new / delete, ⌘⌥Z undo
- **session restore** — last open file + folder come back on launch
- **save as** — ⌘⇧s opens save-as dialog (also auto-fallback for untitled buffers)
- **markdown extras** — `==highlight==` (mark), `~~strike~~`, `[ ] / [x]` task lists with theme-aware checkboxes
- **share to ai** — ⌘⇧c copies clean markdown to clipboard
- **context tray** — stage multiple sidebar files, see file/token counts, copy them as one prompt bundle
- **export to pdf** — visible file-action button + ⌘p
- **external file watch** — auto-reloads when the file changes outside the app · conflict toast on dirty buffer
- **cross-platform auto-update** — minisign-signed releases on macOS / Windows / Linux
- **window transparency slider** — continuous opacity, macOS vibrancy
- **platform-aware shortcuts** — ⌘ on mac, Ctrl on Windows/Linux, surfaced correctly everywhere
- **no autosave** — ⌘s commits. trust your fingers, not background daemons.

## install

[download the latest release →](https://github.com/mattenarle10/markamd/releases/latest)

### macOS

- **apple silicon** (M1/M2/M3/M4): grab `marka.md.dmg` → drag **marka.md.app** into `/Applications` → open.
- **intel mac**: grab `marka.md_intel.dmg` → same install steps.

### Windows (10+, x64)

grab `marka.md_*-setup.exe` → run. Windows SmartScreen may ask for confirmation because the Windows build is unsigned.

### Linux (x86_64)

three flavors, pick what fits your distro:

- **AppImage** (works anywhere): `chmod +x marka.md_*.AppImage` → run. self-contained, no install step needed.
- **.deb** (Debian / Ubuntu / Mint / Pop!_OS): `sudo dpkg -i marka.md_*_amd64.deb`
- **.rpm** (Fedora / RHEL / Rocky / openSUSE): `sudo dnf install marka.md-*.x86_64.rpm`

### from source

requires bun, rust, and platform build tools. on Linux, install `libwebkit2gtk-4.1-dev libsoup-3.0-dev` and related Tauri deps.

```sh
bun install
bun run tauri dev      # native window with hmr
bun run tauri build    # produces .dmg / .exe / .AppImage / .deb / .rpm under src-tauri/target/release/bundle/
```

## keyboard

shortcuts shown with **macOS** modifiers below. on **Windows / Linux**, substitute `⌘` → `Ctrl`, `⌥` → `Alt`, `⇧` → `Shift`.

| key | does |
|---|---|
| ⌘K | command palette |
| ⌘O | open a `.md` file |
| ⌘⇧O | open a folder of notes |
| ⌘N | new untitled buffer |
| ⌘S | save (manual — no autosave) |
| ⌘⇧S | save as (also auto-fallback for untitled buffers) |
| ⌘B | toggle sidebar |
| ⌘. | toggle reading mode (preview only) |
| ⌘⇧. | toggle editor-only mode (preview hidden) |
| ⌘F | find / replace in editor · or find in reading mode |
| ⌘G | find next match |
| ⌘⌥Z | undo last sidebar file op (move / rename / new / delete) |
| ⌘⇧C | copy markdown to clipboard |
| command palette → copy context bundle | copy the staged context bundle |
| ⌘P | export to pdf (also visible in the top file-action row) |
| ⌃⌘F | toggle fullscreen (macOS) · F11 on Windows/Linux |
| ⌘/ | help overlay |
| esc | close any popup |

## stack

| layer | choice |
|---|---|
| shell | tauri 2.11 (rust + webview), macOS universal (arm64 + x86_64) · Windows · Linux |
| frontend | react 19 · vite 7 · typescript 5.9 · bun |
| editor | codemirror 6 + `@codemirror/lang-markdown` + `@codemirror/search` · opt-in vim via `@replit/codemirror-vim` |
| markdown | markdown-it + markdown-it-mark + markdown-it-task-lists + shiki (lazy themes + langs) + mermaid (lazy) |
| icons | lucide-react |
| styling | css variables, no framework |

## project structure

- `src/components` — chrome, editor, files, overlays, and primitives
- `src/hooks` — app state, file session, shortcuts, file watcher, sync scroll
- `src/lib` — markdown, themes, files, commands, pdf export, updater, storage
- `src/styles` — domain-scoped css for chrome, editor, files, overlays, shared UI
- `src-tauri` — rust shell, capabilities, tauri config
- `.github/workflows` — ci, release, dependabot

folders export their public api via `index.ts`. path alias `@/*` resolves to `src/*`.

## roadmap

per-release detail lives on the [changelog](https://markamd.vercel.app/changelog) (auto-fresh from GitHub releases). high-level:

**v1.5**:
- **context tray** — multi-file bundling, ⌘-click to stage, token estimates, copy as one prompt blob
- **what's new toast** — first launch after update now points users straight to the changelog
- **pdf export polish** — cleaner document margins, no browser-added date/time/path headers, and rendered mermaid diagrams
- **theme polish** — mono / mono dark, animated grouped theme menu, and AI-inspired Claude / Codex / Gemini / Cursor palettes
- **file tabs + languages** — open multiple notes, switch between them quickly, and use the app in more interface languages
- **code block wrapping** — long rendered code lines wrap in preview and PDF export
- **macOS app naming + file handling** — packaged builds use `marka.md` consistently and default-handler launches open the selected markdown file reliably

**next**:
- native/silent PDF generation, so export does not depend on the browser print dialog
- optional richer context bundle presets for agents with stricter prompt formats

## contributors

PRs are welcome. The best contributions are small, focused, and easy to test.

Good places to help:

- bug fixes from the [issue tracker](https://github.com/mattenarle10/markamd/issues)
- platform polish for Windows, Linux, and Intel macOS
- markdown / mermaid / pdf edge cases
- translations and copy cleanup
- small UX improvements with screenshots or short screen recordings

Before opening a PR:

- keep one behavior change per PR when possible
- include screenshots for UI changes
- update help/about/readme copy when the user-facing surface changes
- run `bun test`, `bun run build`, and `cargo check --release` from `src-tauri`

For larger ideas, open a feedback issue first so we can keep the app focused.

## privacy

local-first. no telemetry, no accounts, no cloud sync. your `.md` files stay on disk, and clipboard transfers happen only when you copy.

see [the full privacy notice](https://markamd.vercel.app/privacy) for the website analytics caveat (vercel speed insights, cookieless).

## feedback

ideas, bugs, or just want to say hi?

- **structured form (GitHub)** — [feedback](https://github.com/mattenarle10/markamd/issues/new?template=feedback.yml) · [bug report](https://github.com/mattenarle10/markamd/issues/new?template=bug-report.yml)
- **prefer email?** → [enarlem10@gmail.com](mailto:enarlem10@gmail.com?subject=marka.md%20feedback)
- **landing page hub** → [markamd.vercel.app/feedback](https://markamd.vercel.app/feedback)
- **security issues** → [SECURITY.md](./SECURITY.md)

## support

marka.md is free + MIT. if it saves you time, [star the repo](https://github.com/mattenarle10/markamd) or share it with another dev.

## license

mit · matt enarle ([@mattenarle10](https://github.com/mattenarle10))
