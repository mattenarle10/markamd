import interRanges from "@fontsource/inter/unicode.json";
import monoRanges from "@fontsource/jetbrains-mono/unicode.json";
import type { ProseFontFamily } from "./writing-display";

const fontFiles = import.meta.glob<string>([
  "/node_modules/@fontsource/inter/files/*-{400,600}-normal.woff2",
  "/node_modules/@fontsource/jetbrains-mono/files/*-{400,600}-normal.woff2",
], { eager: true, query: "?inline", import: "default" });

/** Keep browser print documents independent of installed fonts and app URLs. */
export function getPrintFontFaces(proseFontFamily: ProseFontFamily): string {
  const families = [
    { id: "jetbrains-mono", name: "JetBrains Mono", ranges: monoRanges },
  ];
  if (proseFontFamily === "inter") {
    families.push({ id: "inter", name: "Inter", ranges: interRanges });
  }

  const faces: string[] = [];
  for (const { id, name, ranges } of families) {
    for (const weight of [400, 600]) {
      for (const [subset, unicodeRange] of Object.entries(ranges)) {
        const asset = `/node_modules/@fontsource/${id}/files/${id}-${subset}-${weight}-normal.woff2`;
        const dataUrl = fontFiles[asset];
        if (!dataUrl?.startsWith("data:")) throw new Error(`missing embedded print font: ${asset}`);
        faces.push(`@font-face {
          font-family: "${name}";
          font-style: normal;
          font-weight: ${weight};
          src: url("${dataUrl}") format("woff2");
          unicode-range: ${unicodeRange};
        }`);
      }
    }
  }
  return faces.join("\n");
}
