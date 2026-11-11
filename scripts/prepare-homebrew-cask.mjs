// Run after publishing the first release containing the macOS terminal command.
// Output goes to stdout for review in the separate Homebrew tap repository.
import { pathToFileURL } from 'node:url';

export function renderCask(release) {
  const match = /^v(\d+\.\d+\.\d+)$/.exec(release.tag_name);
  if (!match || release.draft || release.prerelease) throw new Error('Expected a public stable release');
  const [major, minor, patch] = match[1].split('.').map(Number);
  if (major < 1 || (major === 1 && (minor < 7 || (minor === 7 && patch < 11)))) throw new Error('This cask layout requires the CLI release, v1.7.11 or later');
  const digest = name => {
    const asset = release.assets.find(a => a.name === name);
    if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest ?? '')) throw new Error(`Missing SHA-256 digest for ${name}`);
    return asset.digest.slice(7);
  };
  return `cask "marka-md" do
  arch arm: "", intel: "_intel"
  version "${match[1]}"
  sha256 arm: "${digest('marka.md.dmg')}",
         intel: "${digest('marka.md_intel.dmg')}"

  url "https://github.com/mattenarle10/markamd/releases/download/v#{version}/marka.md#{arch}.dmg",
      verified: "github.com/mattenarle10/markamd/"
  name "marka.md"
  desc "Local markdown editor for notes you share with AI"
  homepage "https://markamd.vercel.app/"
  livecheck do
    url "https://github.com/mattenarle10/markamd"
    strategy :github_latest
  end
  auto_updates true
  depends_on macos: :ventura
  app "marka.app"
  binary "#{appdir}/marka.app/Contents/Resources/cli/marka"
  zap trash: [
    "~/Library/Application Support/com.mattenarle.markamd",
    "~/Library/Caches/com.mattenarle.markamd",
    "~/Library/HTTPStorages/com.mattenarle.markamd",
    "~/Library/Preferences/com.mattenarle.markamd.plist",
    "~/Library/Saved Application State/com.mattenarle.markamd.savedState",
    "~/Library/WebKit/com.mattenarle.markamd",
  ]
end
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tag = process.argv[2];
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) throw new Error('Usage: bun scripts/prepare-homebrew-cask.mjs vX.Y.Z');
  const response = await fetch(`https://api.github.com/repos/mattenarle10/markamd/releases/tags/${tag}`);
  if (!response.ok) throw new Error(`Release lookup failed: ${response.status}`);
  process.stdout.write(renderCask(await response.json()));
}
