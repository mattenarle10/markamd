import { expect, test } from "bun:test";
import { renderCask } from "../scripts/prepare-homebrew-cask.mjs";

test("prepares both architecture hashes, the renamed app and bundled CLI", () => {
  const release = { tag_name: "v1.7.11", draft: false, prerelease: false, assets: [
    { name: "marka.md.dmg", digest: `sha256:${"a".repeat(64)}` },
    { name: "marka.md_intel.dmg", digest: `sha256:${"b".repeat(64)}` },
  ] };
  const output = renderCask(release);
  expect(output).toContain('app "marka.app"');
  expect(output).toContain('binary "#{appdir}/marka.app/Contents/Resources/cli/marka"');
  expect(output).toContain('version "1.7.11"');
  expect(output).toContain("b".repeat(64));
  expect(() => renderCask({ ...release, draft: true })).toThrow();
  expect(() => renderCask({ ...release, assets: [] })).toThrow();
});
