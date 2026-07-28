import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLatestJsonUrls } from "../scripts/normalize-latest-json.mjs";

test("rewrites updater platform URLs to public release downloads", () => {
  const latestJson = {
    version: "1.7.1",
    platforms: {
      "darwin-aarch64": {
        signature: "signature-a",
        url: "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491082498",
      },
      "darwin-aarch64-app": {
        signature: "signature-a",
        url: "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491082498",
      },
      "windows-x86_64": {
        signature: "signature-w",
        url: "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491085944",
      },
      external: {
        signature: "signature-external",
        url: "https://downloads.example.test/marka.md.tar.gz",
      },
    },
  };

  const { manifest, changed } = normalizeLatestJsonUrls(latestJson, [
    {
      name: "marka.md_1.7.1_aarch64.app.tar.gz",
      url: "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491082498",
      browser_download_url:
        "https://github.com/mattenarle10/markamd/releases/download/v1.7.1/marka.md_1.7.1_aarch64.app.tar.gz",
    },
    {
      name: "marka.md_1.7.1_x64_en-US.msi",
      url: "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491085944",
      browser_download_url:
        "https://github.com/mattenarle10/markamd/releases/download/v1.7.1/marka.md_1.7.1_x64_en-US.msi",
    },
  ]);

  assert.equal(changed, 3);
  assert.equal(
    manifest.platforms["darwin-aarch64"].url,
    "https://github.com/mattenarle10/markamd/releases/download/v1.7.1/marka.md_1.7.1_aarch64.app.tar.gz",
  );
  assert.equal(
    manifest.platforms["darwin-aarch64-app"].url,
    "https://github.com/mattenarle10/markamd/releases/download/v1.7.1/marka.md_1.7.1_aarch64.app.tar.gz",
  );
  assert.equal(
    manifest.platforms["windows-x86_64"].url,
    "https://github.com/mattenarle10/markamd/releases/download/v1.7.1/marka.md_1.7.1_x64_en-US.msi",
  );
  assert.equal(manifest.platforms.external.url, "https://downloads.example.test/marka.md.tar.gz");
  assert.equal(
    latestJson.platforms["darwin-aarch64"].url,
    "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491082498",
  );
});

test("throws when a GitHub REST asset URL has no matching release asset", () => {
  assert.throws(
    () =>
      normalizeLatestJsonUrls(
        {
          platforms: {
            "linux-x86_64": {
              signature: "signature-l",
              url: "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491085196",
            },
          },
        },
        [],
      ),
    /unmapped GitHub REST asset URLs/,
  );
});

test("accepts the full release object shape returned by the GitHub API", () => {
  const { manifest, changed } = normalizeLatestJsonUrls(
    {
      platforms: {
        "linux-x86_64": {
          signature: "signature-l",
          url: "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491085196",
        },
      },
    },
    {
      assets: [
        {
          url: "https://api.github.com/repos/mattenarle10/markamd/releases/assets/491085196",
          browser_download_url:
            "https://github.com/mattenarle10/markamd/releases/download/v1.7.1/marka.md_1.7.1_amd64.AppImage",
        },
      ],
    },
  );

  assert.equal(changed, 1);
  assert.equal(
    manifest.platforms["linux-x86_64"].url,
    "https://github.com/mattenarle10/markamd/releases/download/v1.7.1/marka.md_1.7.1_amd64.AppImage",
  );
});
