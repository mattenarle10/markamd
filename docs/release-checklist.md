# Release checklist

Use this after the version bump commit is ready and before calling the release done.

## before tagging

- [ ] App versions match in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.lock`.
- [ ] Release notes exist at `docs/release-notes/vX.Y.Z.md`.
- [ ] Merge the feature PR first, then make the version bump in a separate release PR based on `origin/main`.
- [ ] `bun test` passes.
- [ ] `bun run build` passes.
- [ ] `cargo check --release` passes from `src-tauri`.
- [ ] `git diff --check` is clean.
- [ ] Linux AppImage smoke test passes on Wayland, including the reported Manjaro environment for #107.

## after tagging

- [ ] `main`, `origin/main`, and `vX.Y.Z` point at the intended release commit.
- [ ] GitHub `ci` workflow passes on `main`.
- [ ] GitHub `release` workflow passes on the tag.
- [ ] GitHub release is public, latest, and has macOS, Windows, Linux, signature, and `latest.json` assets.
- [ ] Download `latest.json` and confirm the version, release notes, platform URLs, and signatures are present.
- [ ] Confirm `latest.json` platform URLs use public `https://github.com/.../releases/download/...` links, not `https://api.github.com/.../releases/assets/...` REST API links.

The tag must resolve to the same commit as `origin/main` (`git rev-parse vX.Y.Z^{}` versus `git rev-parse origin/main`). Use the repository's configured GitHub account for PR and release operations, and verify the author before merging.

## site refresh

- [ ] Confirm the `notify-site` job ran or the `VERCEL_DEPLOY_HOOK` secret is configured.
- [ ] Check `https://markamd.vercel.app/` shows the new version in download links, schema, footer, and release section.
- [ ] Check `https://markamd.vercel.app/changelog/` starts with the new release notes.
- [ ] If the site is stale, rebuild/redeploy `markamd-site` or push a small site refresh commit.

The landing site reads the latest GitHub release and repository stats at build time. Check the live homepage and `/changelog/` before making a site change; a successful release does not guarantee that a Vercel deploy hook is configured.

## triage

- [ ] Check open issues and PRs after release.
- [ ] Reply to contributors or reporters whose fixes shipped.
- [ ] Note any regressions or follow-up items before marketing the release.
