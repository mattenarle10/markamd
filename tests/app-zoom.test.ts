import { expect, test } from "bun:test";
import { normalizeZoomLevel } from "../src/hooks/use-app-zoom";

test("normalizeZoomLevel clamps to the supported range", () => {
  expect(normalizeZoomLevel(0)).toBe(0.5);
  expect(normalizeZoomLevel(0.05)).toBe(0.5);
  expect(normalizeZoomLevel(99)).toBe(3);
  expect(normalizeZoomLevel(0.5)).toBe(0.5); // exact bounds are no-ops
  expect(normalizeZoomLevel(3)).toBe(3);
});

test("normalizeZoomLevel repairs corrupt persisted values to 100%", () => {
  expect(normalizeZoomLevel(null)).toBe(1);
  expect(normalizeZoomLevel(undefined)).toBe(1);
  expect(normalizeZoomLevel("1.5")).toBe(1); // strings are corrupt, not coerced
  expect(normalizeZoomLevel(Number.NaN)).toBe(1);
  expect(normalizeZoomLevel(Number.POSITIVE_INFINITY)).toBe(1);
  expect(normalizeZoomLevel({})).toBe(1);
});

test("normalizeZoomLevel rounds to one decimal so ±0.1 stepping never drifts", () => {
  expect(normalizeZoomLevel(1.2000000000000002)).toBe(1.2);
  let level = 1;
  for (let i = 0; i < 20; i += 1) level = normalizeZoomLevel(level + 0.1);
  expect(level).toBe(3);
  for (let i = 0; i < 50; i += 1) level = normalizeZoomLevel(level - 0.1);
  expect(level).toBe(0.5);
});
