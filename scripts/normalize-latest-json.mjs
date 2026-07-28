#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

const GITHUB_RELEASE_ASSET_API_URL =
  /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/assets\/\d+$/;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getReleaseAssets(releaseAssets) {
  if (Array.isArray(releaseAssets)) {
    return releaseAssets;
  }

  if (releaseAssets && typeof releaseAssets === "object" && Array.isArray(releaseAssets.assets)) {
    return releaseAssets.assets;
  }

  throw new TypeError("release assets must be an array or an object with an assets array");
}

export function normalizeLatestJsonUrls(latestJson, releaseAssets) {
  if (!latestJson || typeof latestJson !== "object" || Array.isArray(latestJson)) {
    throw new TypeError("latest.json must be a JSON object");
  }

  const downloadUrlByApiUrl = new Map();
  for (const asset of getReleaseAssets(releaseAssets)) {
    if (!asset || typeof asset !== "object") {
      continue;
    }

    if (typeof asset.url === "string" && typeof asset.browser_download_url === "string") {
      downloadUrlByApiUrl.set(asset.url, asset.browser_download_url);
    }
  }

  const manifest = cloneJson(latestJson);
  const platforms = manifest.platforms;
  if (!platforms || typeof platforms !== "object" || Array.isArray(platforms)) {
    return { manifest, changed: 0 };
  }

  const unresolvedRestUrls = [];
  let changed = 0;

  for (const [platformName, platform] of Object.entries(platforms)) {
    if (!platform || typeof platform !== "object" || Array.isArray(platform) || typeof platform.url !== "string") {
      continue;
    }

    const publicDownloadUrl = downloadUrlByApiUrl.get(platform.url);
    if (publicDownloadUrl) {
      platform.url = publicDownloadUrl;
      changed += 1;
      continue;
    }

    if (GITHUB_RELEASE_ASSET_API_URL.test(platform.url)) {
      unresolvedRestUrls.push(`${platformName}: ${platform.url}`);
    }
  }

  if (unresolvedRestUrls.length > 0) {
    throw new Error(`latest.json still contains unmapped GitHub REST asset URLs:\n${unresolvedRestUrls.join("\n")}`);
  }

  return { manifest, changed };
}

async function main() {
  const [latestJsonPath, releaseAssetsPath, outputPath] = process.argv.slice(2);
  if (!latestJsonPath || !releaseAssetsPath || !outputPath) {
    console.error("usage: normalize-latest-json.mjs <latest.json> <release-assets.json> <output.json>");
    process.exitCode = 2;
    return;
  }

  const latestJson = JSON.parse(await readFile(latestJsonPath, "utf8"));
  const releaseAssets = JSON.parse(await readFile(releaseAssetsPath, "utf8"));
  const { manifest, changed } = normalizeLatestJsonUrls(latestJson, releaseAssets);

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`normalized ${changed} latest.json platform URL${changed === 1 ? "" : "s"}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
