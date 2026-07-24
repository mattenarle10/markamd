import { expect, test } from "bun:test";
import { previewKindForPath, previewMimeForPath } from "../src/lib/preview";

test("classifies images by extension", () => {
  expect(previewKindForPath("a.png")).toBe("image");
  expect(previewKindForPath("x/IMG.JPEG")).toBe("image");
  expect(previewKindForPath("diagram.svg")).toBe("image");
  expect(previewKindForPath("photo.webp")).toBe("image");
});

test("classifies video and audio", () => {
  expect(previewKindForPath("clip.mp4")).toBe("video");
  expect(previewKindForPath("clip.MOV")).toBe("video");
  expect(previewKindForPath("song.mp3")).toBe("audio");
  expect(previewKindForPath("voice.flac")).toBe("audio");
});

test("classifies pdf", () => {
  expect(previewKindForPath("paper.pdf")).toBe("pdf");
  expect(previewKindForPath("PAPER.PDF")).toBe("pdf");
});

test("classifies office documents as info-card", () => {
  expect(previewKindForPath("report.docx")).toBe("office");
  expect(previewKindForPath("sheet.xlsx")).toBe("office");
  expect(previewKindForPath("deck.pptx")).toBe("office");
  expect(previewKindForPath("old.doc")).toBe("office");
});

test("classifies text and code as read-only text", () => {
  expect(previewKindForPath("config.json")).toBe("text");
  expect(previewKindForPath("deploy.sh")).toBe("text");
  expect(previewKindForPath("app.tsx")).toBe("text");
  expect(previewKindForPath("notes/README")).toBe("text");
  expect(previewKindForPath(".gitignore")).toBe("text");
  expect(previewKindForPath("Dockerfile")).toBe("text");
});

test("falls back to unsupported for unknown / binary formats", () => {
  expect(previewKindForPath("archive.zip")).toBe("unsupported");
  expect(previewKindForPath("app.exe")).toBe("unsupported");
  expect(previewKindForPath("noextfile")).toBe("unsupported");
  expect(previewKindForPath("data.xyz")).toBe("unsupported");
});

test("mime for embeddable binary kinds", () => {
  expect(previewMimeForPath("a.png")).toBe("image/png");
  expect(previewMimeForPath("a.JPG")).toBe("image/jpeg");
  expect(previewMimeForPath("clip.mp4")).toBe("video/mp4");
  expect(previewMimeForPath("paper.pdf")).toBe("application/pdf");
  // non-binary kinds have no embed mime
  expect(previewMimeForPath("config.json")).toBe("");
  expect(previewMimeForPath("report.docx")).toBe("");
});
