import type { InsertResult } from "./handles";
import { OperationRejectedError } from "./errors";
import { LoroDoc, LoroMap, LoroMovableList, LoroText } from "loro-crdt";
import {
  isScalar,
  validate,
  type Node,
  type ObjectNode,
  type Path,
  type Field,
  type Scalar,
  type OptionalNode,
  type Text,
  type ListNode,
  type Input,
} from "./schema";
export type Destination = { before: string; after?: never } | { after: string; before?: never };
export type Operation =
  | { type: "set"; path: Path; value: string | boolean | number }
  | { type: "clear"; path: Path }
  | { type: "text.replace"; path: Path; value: string }
  | { type: "insert"; path: Path; value: unknown }
  | { type: "remove"; path: Path; id: string }
  | { type: "move"; path: Path; id: string; destination: Destination };
/** Typed commands shared by the live document and staging fork. */
export class Commands {
  constructor(private dispatch: (operation: Operation) => InsertResult | void) {}
  execute(operation: Operation) {
    return this.dispatch(operation);
  }
  set<T extends Scalar | OptionalNode>(
    field: Field<T>,
    value: Exclude<NoInfer<Input<T>>, undefined>,
  ) {
    this.dispatch({ type: "set", path: field.path, value });
  }
  clear(field: Field<OptionalNode>) {
    this.dispatch({ type: "clear", path: field.path });
  }
  text(field: Field<Text>) {
    return {
      replace: (value: string) => this.dispatch({ type: "text.replace", path: field.path, value }),
    };
  }
  insert<I extends ObjectNode>(field: Field<ListNode<I>>, value: NoInfer<Input<I>>) {
    return this.dispatch({ type: "insert", path: field.path, value }) as InsertResult;
  }
  remove(field: Field<ListNode>, id: string) {
    this.dispatch({ type: "remove", path: field.path, id });
  }
  move(field: Field<ListNode>, id: string, destination: Destination) {
    this.dispatch({ type: "move", path: field.path, id, destination });
  }
}
export function applyOperation(engine: LoroDoc, root: ObjectNode, op: Operation) {
  if (!op || !Array.isArray(op.path)) throw new OperationRejectedError("Invalid operation path");
  let node: Node = root,
    value: any = engine.getMap("data"),
    parent: any,
    key: string | number = "";
  for (const part of op.path) {
    parent = value;
    if (
      typeof part === "string" &&
      node.kind === "object" &&
      Object.hasOwn(node.properties, part)
    ) {
      key = part;
      node = node.properties[part]!;
      value = value.get(part);
    } else if (
      part &&
      typeof part === "object" &&
      node.kind === "list" &&
      typeof part.id === "string"
    ) {
      key = rowIndex(value, part.id, op.path);
      node = node.item;
      value = value.get(key);
    } else throw new OperationRejectedError("Unknown schema path");
  }
  if (op.type === "set") {
    const scalar = node.kind === "optional" ? node.inner : node;
    if (!isScalar(scalar))
      throw new OperationRejectedError("set requires a scalar; use text(field).replace for text");
    validate(scalar, op.value);
    parent.set(key, op.value);
  } else if (op.type === "clear") {
    if (node.kind !== "optional")
      throw new OperationRejectedError("Only optional scalar fields can be cleared");
    parent.delete(key);
  } else if (op.type === "text.replace") {
    if (node.kind !== "text") throw new OperationRejectedError("text.replace requires Loro text");
    validate(node, op.value);
    value.update(op.value);
  } else {
    if (node.kind !== "list") throw new OperationRejectedError("Operation requires a list field");
    const list = value as LoroMovableList;
    if (op.type === "insert") {
      validate(node.item, op.value);
      const row = list.insertContainer(list.length, new LoroMap());
      fill(row, node.item, op.value);
      return Object.freeze({ id: row.id });
    } else if (op.type === "remove") list.delete(rowIndex(list, op.id, op.path), 1);
    else if (op.type === "move") {
      const from = rowIndex(list, op.id, op.path),
        destination = op.destination;
      if (
        !destination ||
        (typeof destination.before === "string") === (typeof destination.after === "string")
      )
        throw new OperationRejectedError("Move requires exactly one before/after ID");
      const target = rowIndex(list, destination.before ?? destination.after!, op.path);
      if (from === target) return;
      const to = target - (from < target ? 1 : 0) + (destination.after !== undefined ? 1 : 0);
      list.move(from, to);
    } else throw new OperationRejectedError("Unknown operation");
  }
}
function rowIndex(list: LoroMovableList, id: string, path: Path) {
  const index = list.toArray().findIndex((row) => (row as LoroMap).id === id);
  if (index < 0)
    throw new OperationRejectedError(`Unknown row ID: ${id} at ${JSON.stringify(path)}`);
  return index;
}
export function fill(map: LoroMap, node: ObjectNode, input: any): void {
  for (const [key, child] of Object.entries(node.properties)) {
    const value = input[key];
    if (child.kind === "optional" && value === undefined) continue;
    if (child.kind === "text") map.setContainer(key, new LoroText()).update(value);
    else if (child.kind === "object") fill(map.setContainer(key, new LoroMap()), child, value);
    else if (child.kind === "list") {
      const list = map.setContainer(key, new LoroMovableList());
      for (const item of value)
        fill(list.insertContainer(list.length, new LoroMap()), child.item, item);
    } else map.set(key, value);
  }
}
/** Validates container kinds as well as values; a string register is not a LoroText. */
export function project(node: Node, value: any, previous?: any): any {
  if (node.kind === "text") {
    if (value?.kind?.() !== "Text") throw new Error("Expected LoroText");
    return value.toString();
  }
  if (node.kind === "list") {
    if (value?.kind?.() !== "MovableList") throw new Error("Expected LoroMovableList");
    const byID = new Map<string, any>(
      (Array.isArray(previous) ? previous : []).map((row: any) => [row.$id, row]),
    );
    const rows = value.toArray().map((row: LoroMap) => {
      const before = byID.get(row.id),
        next = project(node.item, row, before);
      return before && next === before ? before : Object.freeze({ ...next, $id: row.id });
    });
    return Array.isArray(previous) &&
      rows.length === previous.length &&
      rows.every((row: any, i: number) => row === previous[i])
      ? previous
      : Object.freeze(rows);
  }
  if (node.kind !== "object") {
    validate(node, value);
    return value;
  }
  if (value?.kind?.() !== "Map") throw new Error("Expected LoroMap");
  for (const key of value.keys())
    if (!Object.hasOwn(node.properties, key)) throw new Error(`Unknown stored field: ${key}`);
  const next = Object.fromEntries(
    Object.entries(node.properties).flatMap(([key, child]) => {
      const projected = project(child, value.get(key), previous?.[key]);
      return projected === undefined ? [] : [[key, projected]];
    }),
  );
  if (
    previous &&
    Object.keys(previous).filter((key) => key !== "$id").length === Object.keys(next).length &&
    Object.keys(next).every((key) => next[key] === previous[key])
  )
    return previous;
  return Object.freeze(next);
}
