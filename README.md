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
  <a href="https://opencollective.com/markamd"><img src="https://img.shields.io/opencollective/all/markamd?style=flat-square&color=orange&label=open%20collective" alt="open collective" /></a>
  <img src="https://img.shields.io/badge/macOS-13%2B-black?style=flat-square" alt="macos" />
  <img src="https://img.shields.io/badge/Windows-10%2B-black?style=flat-square" alt="windows" />
  <img src="https://img.shields.io/badge/Linux-x86__64-black?style=flat-square" alt="linux" />
  <img src="https://img.shields.io/badge/license-MIT-black?style=flat-square" alt="mit" />
  <img src="https://img.shields.io/badge/notarized-Apple%20Developer-orange?style=flat-square" alt="notarized" />
</p>

a cross-platform (**macOS · Windows · Linux**) markdown editor specialized for **ai context management**. live editor, rendered preview, file tabs, csv preview, grouped themes, smarter command palette, and a context tray for staging multiple notes into one AI-ready bundle.

> built around one loop: **collect notes → write → share with ai**. nothing leaves your machine until you copy.

works with claude, chatgpt, gemini, local agents, and anything that reads plain markdown.

## what you get

| area | details |
|---|---|
| writing | live preview, shiki highlighting, mermaid diagrams, task lists, mark/strike syntax, reading mode, editor-only mode, opt-in vim |
| ai context | stage sidebar files, see file/token counts, copy one AI-ready bundle with relative paths |
| files | tabs, folder sidebar, favorites, search, drag-to-move, undo file ops, copy paths, reveal in file manager, useful dot-tool folders |
| data + export | capped CSV preview, rendered code copy buttons, mermaid-aware PDF export, stable print margins |
| desktop polish | grouped themes, transparency controls, platform-aware shortcuts, session restore, external file watching, signed updates |

## install

[download the latest release →](https://github.com/mattenarle10/markamd/releases/latest)

### macOS

- **homebrew**: `brew install --cask mattenarle10/tap/marka-md`
- **apple silicon** (M1/M2/M3/M4): grab `marka.md.dmg` → drag **marka.md.app** into `/Applications` → open.
- **intel mac**: grab `marka.md_intel.dmg` → same install steps.

Homebrew users can update with `brew update && brew upgrade --cask marka-md`. The in-app signed updater still works too.

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
| ⌘S | save |
| ⌘⇧S | save as (also handles untitled buffers) |
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

## roadmap

Per-release detail lives on the [changelog](https://markamd.vercel.app/changelog).

- [x] v1.5 core loop: context tray, file tabs, CSV preview, grouped themes, interface languages, PDF/export polish, file workflow improvements, preview link handling, and scroll memory
- [x] v1.5.12 polish: smoother preview scrolling, cleaner sidebar, refreshed demo doc, quickstart tutorial updates, and smarter command palette search
- [ ] next: native/silent PDF generation
- [ ] next: context handoff presets for bring-your-own-ai workflows, starting with markdown and XML-tag bundle formats

Release work follows the [release checklist](docs/release-checklist.md), including the post-release site refresh check.

## contributors

Thanks to everyone helping shape marka.md through PRs, issues, testing, and feedback.

<p>
  <a href="https://github.com/mattenarle10/markamd/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=mattenarle10/markamd" alt="marka.md contributors" />
  </a>
</p>

Small, focused PRs are easiest to review and ship. Good places to help:

- bug fixes from the [issue tracker](https://github.com/mattenarle10/markamd/issues)
- platform polish for Windows, Linux, and Intel macOS
- markdown, mermaid, PDF, and translation edge cases
- small UX improvements with screenshots or short screen recordings

Before opening a PR:

- keep one behavior change per PR when possible
- include screenshots for UI changes
- update help/about/readme copy when the user-facing surface changes
- run `bun test`, `bun run build`, and `cargo check --release` from `src-tauri`

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

marka.md is free + MIT. if it saves you time, [star the repo](https://github.com/mattenarle10/markamd), share it with another dev, or support ongoing development through [Open Collective](https://opencollective.com/markamd).

## license

mit · matt enarle ([@mattenarle10](https://github.com/mattenarle10))
