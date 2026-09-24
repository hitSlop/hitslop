import { expect, test } from "bun:test";
import { Document } from "../src/document";
import { MemoryStore } from "../src/memory";
import schema from "../../../examples/slops/pocket-sheet/schema";
import initial from "../../../examples/slops/pocket-sheet/initial";
import { csv, display, evaluate, literal, parseKey } from "../../../examples/slops/pocket-sheet/formula";

const shown = (inputs: Record<string, string>, key: string) => display(evaluate(inputs).get(key) ?? "");

test("the sample bill splits into a friendly per-person amount", () => {
  const inputs = Object.fromEntries(Object.entries(initial.cells).map(([key, cell]) => [key, cell.input]));
  const results = evaluate(inputs);
  expect(results.get("B5")).toBe(8.96);
  expect(results.get("B6")).toBe(58.71);
  expect(results.get("B9")).toBe(14.68);
  expect(results.get("A2")).toBe("Pizza");
});

test("arithmetic, precedence, functions and text joins", () => {
  const inputs = { A1: "2", A2: "3", A3: "hello", A4: "", B1: "=A1+A2*4", B2: "=(A1+A2)^2", B3: "=-A1+10%",
    B4: '=A3&" "&A1', B5: "=AVERAGE(A1:A4)", B6: "=IF(A1>A2, \"big\", \"small\")", B7: "=ROUND(10/3, 2)",
    B8: "=MAX(A1:A2)-MIN(A1:A2)+COUNT(A1:A4)", B9: "=A4+1", B10: "=abs($a$1-5)", B11: '=A3="HELLO"' };
  const results = evaluate(inputs);
  expect(results.get("B1")).toBe(14);
  expect(results.get("B2")).toBe(25);
  expect(results.get("B3")).toBeCloseTo(-1.9);
  expect(results.get("B4")).toBe("hello 2");
  expect(results.get("B5")).toBe(2.5);
  expect(results.get("B6")).toBe("small");
  expect(results.get("B7")).toBe(3.33);
  expect(results.get("B8")).toBe(3);
  expect(results.get("B9")).toBe(1);
  expect(results.get("B10")).toBe(3);
  expect(results.get("B11")).toBe(true);
});

test("errors are values that flow downstream without throwing", () => {
  const inputs = { A1: "=B1", B1: "=A1", C1: "=A1+1", A2: "=1/0", B2: "=A2*2", A3: "=Z9", A4: "=NOPE(1)", A5: "=1+",
    A6: '="a"*2', A7: "=SUM(A2:A2)", A8: "=A12+1", A9: "=G1" };
  expect(shown(inputs, "A1")).toBe("#CYCLE!");
  expect(shown(inputs, "B1")).toBe("#CYCLE!");
  expect(shown(inputs, "C1")).toBe("#CYCLE!");
  expect(shown(inputs, "A2")).toBe("#DIV/0!");
  expect(shown(inputs, "B2")).toBe("#DIV/0!");
  expect(shown(inputs, "A3")).toBe("#REF!");
  expect(shown(inputs, "A4")).toBe("#NAME?");
  expect(shown(inputs, "A5")).toBe("#ERR!");
  expect(shown(inputs, "A6")).toBe("#VALUE!");
  expect(shown(inputs, "A7")).toBe("#DIV/0!");
  expect(shown(inputs, "A8")).toBe("1");
  expect(shown(inputs, "A9")).toBe("#REF!");
  expect(shown({ A1: "=A1" }, "A1")).toBe("#CYCLE!");
});

test("plain entries read as numbers only when they look like numbers", () => {
  expect(literal("1,200")).toBe(1200);
  expect(literal(" 15% ")).toBe(0.15);
  expect(literal("-.5")).toBe(-0.5);
  expect(literal("12 eggs")).toBe("12 eggs");
  expect(display(1234.5678)).toBe("1,234.57");
  expect(display(0.125)).toBe("0.125");
  expect(parseKey("f12")).toEqual({ column: 5, row: 11 });
  expect(parseKey("G1")).toBeUndefined();
  expect(parseKey("A13")).toBeUndefined();
});

test("csv export keeps raw entries and formulas, trimmed to the used area", () => {
  expect(csv({ A1: "Cost", B1: "24", B2: "=ROUND(B1/3, 2)", A3: 'Say "hi"', C2: "", D9: "" }))
    .toBe('\uFEFFCost,24\r\n,"=ROUND(B1/3, 2)"\r\n"Say ""hi""",\r\n');
  expect(csv({ B2: "🍕\nslice", A1: " padded" })).toBe('\uFEFF" padded",\r\n,"🍕\nslice"\r\n');
  expect(csv({})).toBe("\uFEFF");
  const sample = csv(Object.fromEntries(Object.entries(initial.cells).map(([key, cell]) => [key, cell.input])));
  expect(sample.split("\r\n")).toHaveLength(10);
  expect(sample).toContain('Tip,"=ROUND(SUM(B2:B4)*18%, 2)",\r\n');
});

test("cells put, decorate, clear and survive reopening", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(schema, store, initial);
  doc.fields.cells.put("D1", { input: "=B9*2" });
  doc.change(tx => {
    tx.fields.cells.entry("D1").tint.set("rose");
    tx.fields.cells.entry("A2").stamp.clear();
    tx.fields.cells.delete("C4");
  });
  doc.fields.widths.put("D", 150);
  await doc.close();
  const reopened = await Document.open(schema, store, initial);
  expect(reopened.current.cells.D1).toEqual({ input: "=B9*2", tint: "rose" });
  expect(reopened.current.cells.A2).toEqual({ input: "Pizza" });
  expect(reopened.current.cells.C4).toBeUndefined();
  expect(reopened.current.widths).toEqual({ A: 128, D: 150 });
  expect(() => reopened.fields.cells.entry("D1").tint.set("orange" as any)).toThrow();
  expect(() => reopened.fields.widths.put("E", 1000)).toThrow();
  await reopened.close();
});
