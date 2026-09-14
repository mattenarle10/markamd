import { expect, test } from "bun:test";
import {
  applyTextDirection,
  DEFAULT_TEXT_DIRECTION,
  normalizeTextDirection,
} from "../src/lib/text-direction";

class FakeElement {
  private readonly attrs = new Map<string, string>();

  constructor(public readonly children: FakeElement[] = []) {}

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
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

test("applies automatic direction per prose block", () => {
  const article = new FakeElement([new FakeElement(), new FakeElement(), new FakeElement()]);
  article.querySelectorAll = () => [article.children[2]!];

  applyTextDirection(article as unknown as HTMLElement, "auto");

  expect(article.getAttribute("dir")).toBe("auto");
  expect(article.children[0]?.getAttribute("dir")).toBe("auto");
  expect(article.children[1]?.getAttribute("dir")).toBe("auto");
  expect(article.children[2]?.getAttribute("dir")).toBe("ltr");
});

test("keeps technical content isolated in explicit RTL mode", () => {
  const heading = new FakeElement();
  const inlineCode = new FakeElement();
  const codeBlock = new FakeElement();
  const article = new FakeElement([heading, inlineCode, codeBlock]);
  article.querySelectorAll = () => [inlineCode, codeBlock];

  applyTextDirection(article as unknown as HTMLElement, "rtl");

  expect(article.getAttribute("dir")).toBe("rtl");
  expect(heading.getAttribute("dir")).toBe("rtl");
  expect(inlineCode.getAttribute("dir")).toBe("ltr");
  expect(codeBlock.getAttribute("dir")).toBe("ltr");
});
