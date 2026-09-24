import { expect, test } from "bun:test";
import { Document } from "../src/document";
import { MemoryStore } from "../src/memory";
import schema from "../../../examples/slops/doodle-board/schema";
import initial from "../../../examples/slops/doodle-board/initial";
import { boards, StrokeSamples, strokePath, sweep, defaultBrush, fitWindowSize, type Point } from "../../../examples/slops/doodle-board/drawing";
import { copyStore } from "./helpers";

test("a visible stroke preview flushes on close and survives duplication", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(schema, store, initial);
  const first: Point = [800, 500, 0.5];
  const { id } = doc.fields.strokes.insert({ geometry: strokePath([first], 9, false), color: "#2d63b8" });
  const geometry = strokePath([first, [850, 550, 0.5], [950, 600, 0.5]], 9, false);
  doc.fields.strokes.item(id).geometry.preview(geometry);
  doc.fields.boardShape.set("portrait");
  expect(doc.current.strokes[0]!.geometry).toBe(geometry);
  await doc.close();
  const reopened = await Document.open(schema, store, initial);
  expect(reopened.current.boardShape).toBe("portrait");
  expect(reopened.current.strokes[0]).toMatchObject({ $id: id, geometry, color: "#2d63b8" });
  // Expanding only changes the clip: formerly hidden ink keeps its identity and geometry.
  for (const shape of ["square", "landscape", "portrait"] as const) {
    reopened.fields.boardShape.set(shape);
    expect(reopened.current.strokes[0]!.geometry).toBe(geometry);
    expect(reopened.current.strokes[0]!.$id).toBe(id);
  }
  await reopened.flush();
  const duplicateStore = new MemoryStore();
  await copyStore(store, duplicateStore);
  const duplicate = await Document.open(schema, duplicateStore, initial);
  expect(duplicate.current).toEqual(reopened.current);
  await duplicate.close(); await reopened.close();
});

test("clear removes every stroke including ink beyond the current board", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(schema, store, initial);
  for (const x of [10, 800, 1100]) doc.fields.strokes.insert({ geometry: strokePath([[x, 100, 0.5]], 18, false), color: "#343744" });
  doc.fields.boardShape.set("portrait");
  const removed = doc.current.strokes[1]!.$id;
  doc.fields.strokes.remove(removed);
  expect(doc.current.strokes).toHaveLength(2);
  doc.change(tx => { for (const stroke of doc.current.strokes) tx.fields.strokes.remove(stroke.$id); });
  await doc.close();
  const reopened = await Document.open(schema, store, initial);
  expect(reopened.current.strokes).toEqual([]);
  expect(() => reopened.fields.boardShape.set("custom" as any)).toThrow();
  await reopened.close();
});

test("dots and pressure curves have finite closed geometry; long samples stay bounded", () => {
  const dot = strokePath([[100, 100, 0.5]], 9, false);
  expect(dot.startsWith("M")).toBe(true);
  expect(dot.endsWith("Z")).toBe(true);
  expect(dot).not.toMatch(/NaN|Infinity/);
  const points: Point[] = [[10, 10, 0.1], [40, 80, 0.5], [100, 20, 1]];
  expect(strokePath(points, 18, true)).not.toBe(strokePath(points, 4, true));
  const samples = new StrokeSamples();
  for (let i = 0; i < 30_000; i++) samples.add([i, Math.sin(i / 10) * 50, i % 2 ? 0.2 : 0.8]);
  samples.add([30_000, 0, 0.5], true);
  expect(samples.points.length).toBeLessThanOrEqual(2048);
  expect(samples.points[0]).toEqual([0, 0, 0.8]);
  expect(samples.points.at(-1)).toEqual([30_000, 0, 0.5]);
  expect(strokePath(samples.points, 9, true)).not.toMatch(/NaN|Infinity/);
  expect(boards.portrait).toMatchObject({ width: 700, height: 1000 });
});

test("eraser sweep covers the segment between sparse input events", () => {
  const points = sweep([0, 0, 0.5], [100, 100, 0.5]);
  expect(points[0]).toEqual([0, 0, 0.5]);
  expect(points.at(-1)).toEqual([100, 100, 0.5]);
  for (let i = 1; i < points.length; i++) expect(Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1])).toBeLessThanOrEqual(3);
});

test("window fitting includes measured chrome and scales to the available display", () => {
  const chrome = { width: 24, height: 90 };
  const display = { width: 1920, height: 1080 };
  expect(fitWindowSize("landscape", chrome, display)).toEqual({ width: 744, height: 594 });
  expect(fitWindowSize("square", chrome, display)).toEqual({ width: 744, height: 810 });
  expect(fitWindowSize("portrait", chrome, display)).toEqual({ width: 528, height: 810 });
  const small = fitWindowSize("portrait", chrome, { width: 800, height: 600 });
  expect(small).toEqual({ width: 381, height: 600 });
  expect((small.width - chrome.width) / (small.height - chrome.height)).toBeCloseTo(0.7, 2);
  expect(fitWindowSize("landscape", chrome, { width: 300, height: 600 }).width).toBe(300);
});

test("brush extrema and tapers render finite geometry including taps", () => {
  const curve: Point[] = Array.from({ length: 60 }, (_, i) => [i * 4, 50 + Math.sin(i / 6) * 20, i / 60]);
  const baseline = strokePath(curve, defaultBrush, false);
  expect(strokePath(curve, 9, false)).toBe(baseline);
  for (const size of [1, 64]) for (const smoothing of [0, 1]) for (const thinning of [0, 1]) for (const taper of ["none", "short", "long"] as const) {
    const brush = { size, smoothing, thinning, taper };
    for (const points of [curve, [[20, 20, 0.5]] as Point[]]) {
      const geometry = strokePath(points, brush, true);
      expect(geometry.startsWith("M")).toBe(true);
      expect(geometry.endsWith("Z")).toBe(true);
      expect(geometry).not.toMatch(/NaN|Infinity/);
    }
  }
  expect(strokePath(curve, { ...defaultBrush, taper: "short" }, false)).not.toBe(baseline);
  expect(strokePath(curve, { ...defaultBrush, taper: "long" }, false)).not.toBe(strokePath(curve, { ...defaultBrush, taper: "short" }, false));
  expect(defaultBrush).toEqual({ size: 9, smoothing: 0.6, thinning: 0.45, taper: "none" });
});

test("500 completed strokes persist without rewriting geometry on board changes", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(schema, store, initial);
  doc.change(tx => {
    for (let i = 0; i < 500; i++) tx.fields.strokes.insert({
      geometry: strokePath(Array.from({ length: 60 }, (_, j) => [j * 10, (i % 50) * 14 + Math.sin(j) * 6, 0.5]), 4, false),
      color: "#238063",
    });
  });
  const before = doc.current.strokes;
  doc.fields.boardShape.set("square");
  expect(doc.current.strokes).toBe(before);
  await doc.close();
  const reopened = await Document.open(schema, store, initial);
  expect(reopened.current.strokes).toHaveLength(500);
  expect(reopened.current.strokes[499]).toEqual(before[499]);
  await reopened.close();
});
