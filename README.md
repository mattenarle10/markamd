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

a cross-platform (**macOS · Windows · Linux**) markdown editor specialized for **ai context management**. live editor on the left (codemirror 6), rendered preview on the right (markdown-it + shiki + mermaid). minimal chrome, full catppuccin + matcha themes, orange octopus mascot. ~10 mb bundle.

> built around one loop: **collect notes → write → share with ai**. nothing leaves your machine until you copy.

works with claude, chatgpt, gemini, your local agent — anywhere that reads plain markdown.

## features

- **live preview** — ~50 ms render, shiki code highlighting, mermaid diagrams
- **8 themes** — catppuccin family (latte / frappé / macchiato / mocha), matcha, kanagawa, rose pine, ayu + system auto-switch · hover-to-preview in menu
- **reading mode** — ⌘. distraction-free preview with iA-style typography
- **find** — ⌘f works in BOTH editor (codemirror) and reading mode (text-node walker w/ live highlights)
- **command palette** — ⌘k, fuzzy + grouped
- **ide-style sidebar** — drag-to-move, right-click rename / new / delete, ⌘⌥Z undo
- **share to ai** — ⌘⇧c copies clean markdown to clipboard
- **export to pdf** — ⌘p
- **external file watch** — auto-reloads when the file changes outside the app · conflict toast on dirty buffer
- **cross-platform auto-update** — minisign-signed releases on macOS / Windows / Linux
- **window transparency slider** — continuous opacity, macOS vibrancy
- **platform-aware shortcuts** — ⌘ on mac, Ctrl on Windows/Linux, surfaced correctly everywhere
- **no autosave** — ⌘s commits. trust your fingers, not background daemons.

## install

[download the latest release →](https://github.com/mattenarle10/markamd/releases/latest)

### macOS (notarized + auto-updating, universal arch coverage)

- **apple silicon** (M1/M2/M3/M4): grab `marka.md.dmg` → drag **marka.md.app** into `/Applications` → open.
- **intel mac**: grab `marka.md_intel.dmg` → same install steps.

### Windows (10+, x64)

grab `marka.md_*-setup.exe` → run.

Windows SmartScreen may show "Windows protected your PC". Click **More info** → **Run anyway**. marka.md is free + MIT — we don't sign Windows builds (paid certs aren't worth it for a free OSS project). Full source is right here if you'd rather build it yourself.

### Linux (x86_64)

three flavors, pick what fits your distro:

- **AppImage** (works anywhere): `chmod +x marka.md_*.AppImage` → run. self-contained, no install step needed.
- **.deb** (Debian / Ubuntu / Mint / Pop!_OS): `sudo dpkg -i marka.md_*_amd64.deb`
- **.rpm** (Fedora / RHEL / Rocky / openSUSE): `sudo dnf install marka.md-*.x86_64.rpm`

no signing required on Linux — it's the freedom platform 🐧

### from source

requires bun (or npm), rust toolchain. on macOS: xcode command line tools. on Windows: MSVC build tools (Visual Studio installer → "Desktop development with C++"). on Linux: `libwebkit2gtk-4.1-dev libsoup-3.0-dev` + friends.

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
| ⌘B | toggle sidebar |
| ⌘. | toggle reading mode |
| ⌘F | find / replace in editor · or find in reading mode |
| ⌘G | find next match |
| ⌘⇧C | copy markdown to clipboard |
| ⌘P | export to pdf |
| ⌃⌘F | toggle fullscreen (macOS) · F11 on Windows/Linux |
| ⌘/ | help overlay |
| esc | close any popup |

## stack

| layer | choice |
|---|---|
| shell | tauri 2 (rust + webview), macOS universal + Windows + Linux |
| frontend | react 19 · vite 7 · typescript 5.8 · bun |
| editor | codemirror 6 + `@codemirror/lang-markdown` + `@codemirror/search` |
| markdown | markdown-it + shiki + mermaid |
| icons | lucide-react |
| styling | css variables, no framework |

## project structure

```
src/
├── app.tsx              # shell — state + layout
├── components/
│   ├── primitives/      # button, icon, popover, kbd, shortcut, tooltip
│   ├── chrome/          # title-bar, breadcrumb, status-bar
│   ├── editor/          # editor, preview, splitter
│   ├── files/           # sidebar, file-tree, context-menu
│   └── overlays/        # palette, help, about, welcome, toast
├── hooks/               # debounced, shortcuts, file-watcher, persisted-state
├── lib/                 # markdown, theme, platform, files, commands, window-drag
├── styles/              # tokens, globals, per-domain css
└── assets/mascot/       # in-app sprites
src-tauri/               # rust shell, tauri config, capabilities
.github/workflows/       # release.yml (matrix build) + dependabot
```

every folder exports its public api via `index.ts`. path alias `@/*` resolves to `src/*`.

## roadmap

per-release detail lives on the [changelog](https://markamd.vercel.app/changelog) (auto-fresh from GitHub releases). high-level:

**next** (v1.4+):
- **session restore** — remember last folder + open file + scroll position
- **context tray** — multi-file bundling, ⌘-click to stage, copy as one prompt

contributions welcome — see [feedback](#feedback) below to suggest priorities.

## privacy

local-first. nothing ever leaves your machine. no telemetry, no analytics, no accounts, no cloud sync. your `.md` files stay on disk. clipboard transfers happen only when you press ⌘⇧C — and then they're yours, going wherever you paste them.

see [the full privacy notice](https://markamd.vercel.app/privacy) for the website analytics caveat (vercel speed insights, cookieless).

## feedback

ideas, bugs, or just want to say hi?

- **structured form (GitHub)** — [feedback](https://github.com/mattenarle10/markamd/issues/new?template=feedback.yml) · [bug report](https://github.com/mattenarle10/markamd/issues/new?template=bug-report.yml)
- **prefer email?** → [enarlem10@gmail.com](mailto:enarlem10@gmail.com?subject=marka.md%20feedback)
- **landing page hub** → [markamd.vercel.app/feedback](https://markamd.vercel.app/feedback)
- **security issues** → [SECURITY.md](./SECURITY.md)

i read everything. PRs welcome.

## support

marka.md is free + MIT, and intends to stay that way. if it saves you time wrangling AI context:

- ⭐ [star the repo](https://github.com/mattenarle10/markamd) — biggest single signal
- 🗣️ tell another dev / share it

both appreciated, neither required. 🐙

## license

mit · matt enarle ([@mattenarle10](https://github.com/mattenarle10))
