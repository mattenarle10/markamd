import { expect, test } from "bun:test";
import {
  applyTextDirection,
  DEFAULT_TEXT_DIRECTION,
  normalizeTextDirection,
} from "../src/lib/text-direction";

class FakeElement {
  private readonly attrs = new Map<string, string>();
  textContent = "";
  directionWrites = 0;
  computedDirection = "ltr";
  styleReads = 0;
  ownerDocument = {
    defaultView: {
      getComputedStyle: () => {
        this.styleReads += 1;
        return { direction: this.computedDirection };
      },
    },
  };

  constructor(public readonly children: FakeElement[] = []) {}

  setAttribute(name: string, value: string): void {
    if (name === "dir") this.directionWrites += 1;
    this.attrs.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  querySelectorAll(): FakeElement[] {
    return this.children;
  }
}

test("normalizes invalid text direction values to auto", () => {
  expect(normalizeTextDirection("sideways")).toBe(DEFAULT_TEXT_DIRECTION);
  expect(normalizeTextDirection(null)).toBe(DEFAULT_TEXT_DIRECTION);
  expect(normalizeTextDirection("rtl")).toBe("rtl");
});

test("lets LTR prose inherit direction and keeps RTL blocks automatic", () => {
  const article = new FakeElement([new FakeElement(), new FakeElement(), new FakeElement()]);
  article.children[0]!.textContent = "English, fran\u00e7ais, \u4e2d\u6587, \u{1f600}";
  article.children[1]!.textContent = "\u05e9\u05dc\u05d5\u05dd";
  article.querySelectorAll = () => [article.children[2]!];

  applyTextDirection(article as unknown as HTMLElement, "auto");

  expect(article.getAttribute("dir")).toBe("auto");
  expect(article.children[0]?.getAttribute("dir")).toBeNull();
  expect(article.children[1]?.getAttribute("dir")).toBe("auto");
  expect(article.children[2]?.getAttribute("dir")).toBe("ltr");
});

test("keeps automatic direction on every block when the article resolves RTL", () => {
  const article = new FakeElement([new FakeElement(), new FakeElement()]);
  article.computedDirection = "rtl";
  article.children[0]!.textContent = "\u0627\u0644\u0639\u0631\u0628\u064a\u0629";
  article.children[1]!.textContent = "English";
  article.querySelectorAll = () => [];

  applyTextDirection(article as unknown as HTMLElement, "auto");

  expect(article.children.map((child) => child.getAttribute("dir"))).toEqual(["auto", "auto"]);
});

test.each(["\u200f123", "\u{10800}", "\u{1e900}", "\u{1ee00}"])(
  "keeps native detection for RTL marks and supplementary scripts: %s",
  (text) => {
    const child = new FakeElement();
    child.textContent = text;
    const article = new FakeElement([child]);
    article.querySelectorAll = () => [];

    applyTextDirection(article as unknown as HTMLElement, "auto");

    expect(child.getAttribute("dir")).toBe("auto");
  },
);

test("clears stale block directions when switching back to auto", () => {
  const article = new FakeElement([new FakeElement(), new FakeElement(), new FakeElement()]);
  article.children[0]!.textContent = "English";
  article.children[1]!.textContent = "\u05e9\u05dc\u05d5\u05dd";
  article.querySelectorAll = () => [article.children[2]!];

  applyTextDirection(article as unknown as HTMLElement, "rtl");
  applyTextDirection(article as unknown as HTMLElement, "auto");

  expect(article.getAttribute("dir")).toBe("auto");
  expect(article.children.map((child) => child.getAttribute("dir"))).toEqual([null, "auto", "ltr"]);
});

test("preserves per-block auto direction for detached PDF export articles", () => {
  const article = new FakeElement([new FakeElement(), new FakeElement()]);
  article.computedDirection = "";
  article.querySelectorAll = () => [];

  applyTextDirection(article as unknown as HTMLElement, "auto");

  expect(article.children.map((child) => child.getAttribute("dir"))).toEqual(["auto", "auto"]);
});

test("avoids per-block direction writes for a large LTR document", () => {
  const children = Array.from({ length: 10_000 }, () => {
    const child = new FakeElement();
    child.textContent = "A paragraph in a large exported conversation.";
    return child;
  });
  const article = new FakeElement(children);
  article.querySelectorAll = () => [];

  applyTextDirection(article as unknown as HTMLElement, "auto");

  expect(children.reduce((total, child) => total + child.directionWrites, 0)).toBe(0);
  expect(article.styleReads).toBe(1);
});

test.each(["ltr", "rtl"] as const)("keeps technical content isolated in explicit %s mode", (direction) => {
  const heading = new FakeElement();
  const inlineCode = new FakeElement();
  const codeBlock = new FakeElement();
  const article = new FakeElement([heading, inlineCode, codeBlock]);
  article.querySelectorAll = () => [inlineCode, codeBlock];

  applyTextDirection(article as unknown as HTMLElement, direction);

  expect(article.getAttribute("dir")).toBe(direction);
  expect(heading.getAttribute("dir")).toBe(direction);
  expect(inlineCode.getAttribute("dir")).toBe("ltr");
  expect(codeBlock.getAttribute("dir")).toBe("ltr");
});
