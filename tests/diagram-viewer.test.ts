import { expect, test } from "bun:test";
import {
  decorateImages,
  type DiagramViewerSource,
} from "../src/components/editor/diagram-viewer";

test("opens decorated images without bubbling into preview handlers", () => {
  let clickListener: ((event: MouseEvent) => void) | undefined;
  let prevented = false;
  let stopped = false;
  const image = {
    alt: 'quoted " alt',
    dataset: {} as DOMStringMap,
    draggable: true,
    naturalHeight: 0,
    naturalWidth: 0,
    src: "data:image/svg+xml,<svg></svg>",
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "click") clickListener = listener as (event: MouseEvent) => void;
    },
    closest: () => null,
    getBoundingClientRect: () => ({ height: 240.4, width: 320.6 }),
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "click" && clickListener === listener) clickListener = undefined;
    },
  };
  const root = {
    querySelectorAll: () => [image],
  } as unknown as HTMLElement;
  let opened: DiagramViewerSource | undefined;

  const cleanup = decorateImages(root, (viewer) => {
    opened = viewer;
  });

  clickListener?.({
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
  } as MouseEvent);

  expect(prevented).toBe(true);
  expect(stopped).toBe(true);
  expect(opened).toEqual({
    svg: '<img class="mdv-diagram-viewer__image" src="data:image/svg+xml,&lt;svg&gt;&lt;/svg&gt;" alt="quoted &quot; alt" />',
    width: 321,
    height: 240,
  });
  expect(image.dataset.mdvImageViewer).toBe("true");
  expect(image.draggable).toBe(false);

  cleanup();

  expect(clickListener).toBeUndefined();
  expect(image.dataset.mdvImageViewer).toBeUndefined();
});

test("leaves linked images to their anchor navigation", () => {
  let listenerAdded = false;
  const link = {};
  const image = {
    dataset: {} as DOMStringMap,
    draggable: true,
    addEventListener: () => {
      listenerAdded = true;
    },
    closest: (selector: string) => selector === "a[href]" ? link : null,
  };
  const root = {
    querySelectorAll: () => [image],
  } as unknown as HTMLElement;

  const cleanup = decorateImages(root, () => {
    throw new Error("linked images must not open the viewer");
  });

  expect(listenerAdded).toBe(false);
  expect(image.dataset.mdvImageViewer).toBeUndefined();
  expect(image.draggable).toBe(true);
  cleanup();
});
