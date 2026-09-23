import type { InsertResult } from "./handles";
import { OperationRejectedError } from "./errors";
import {
  LoroCounter,
  LoroDoc,
  LoroMap,
  LoroMovableList,
  LoroText,
  LoroTree,
  type ContainerID,
  type LoroTreeNode,
  type TreeID,
} from "loro-crdt";
import {
  checkRecordKey,
  isScalar,
  unwrap,
  validate,
  validateMark,
  type Node,
  type ObjectNode,
  type Path,
  type Field,
  type Scalar,
  type OptionalNode,
  type Text,
  type ListNode,
  type Input,
  type MarkValue,
  type ValueNode,
} from "./schema";
/** Object rows and tree nodes are placed relative to a sibling; tree nodes may also name a parent. */
export type Destination =
  | { before: string; after?: never; parent?: never }
  | { after: string; before?: never; parent?: never }
  | { parent: string | null; before?: never; after?: never };
export type Operation =
  | { type: "set"; path: Path; value: string | boolean | number }
  | { type: "clear"; path: Path }
  | { type: "assign"; path: Path; value: unknown }
  | { type: "text.replace"; path: Path; value: string }
  | { type: "text.splice"; path: Path; index: number; delete: number; insert: string }
  | { type: "text.mark"; path: Path; start: number; end: number; key: string; value: MarkValue }
  | { type: "text.unmark"; path: Path; start: number; end: number; key: string }
  | { type: "insert"; path: Path; value: unknown; destination?: Destination; index?: number }
  | { type: "remove"; path: Path; id?: string; index?: number; count?: number }
  | { type: "move"; path: Path; id?: string; destination?: Destination; from?: number; to?: number }
  | { type: "increment"; path: Path; value: number };
/** Typed commands shared by the live document and staging fork. */
export class Commands {
  constructor(private dispatch: (operation: Operation) => InsertResult | void) {}
  execute(operation: Operation) {
    return this.dispatch(operation);
  }
  set<T extends Scalar | OptionalNode<Scalar>>(
    field: Field<T>,
    value: Exclude<NoInfer<Input<T>>, undefined>,
  ) {
    this.dispatch({ type: "set", path: field.path, value: value as string | number | boolean });
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

type Location = {
  node: Node;
  /** The container holding this value; absent for the document root. */
  parent?: LoroMap | LoroMovableList;
  key: string | number;
  value: any;
  /** Record entries may be created or deleted like optional values. */
  entry: boolean;
};
const reject = (message: string): never => {
  throw new OperationRejectedError(message);
};
const isInt = (value: unknown): value is number => Number.isSafeInteger(value);
function resolve(engine: LoroDoc, root: ObjectNode, path: Path): Location {
  if (!Array.isArray(path)) reject("Invalid operation path");
  let location: Location = { node: root, key: "", value: engine.getMap("data"), entry: false };
  for (const part of path) {
    const { node, value } = location;
    if (value === undefined) reject(`Absent value at ${JSON.stringify(path)}; set it first`);
    const inner = unwrap(node);
    if (typeof part === "string" && inner.kind === "object" && Object.hasOwn(inner.properties, part))
      location = {
        node: inner.properties[part]!,
        parent: value,
        key: part,
        value: value.get(part),
        entry: false,
      };
    else if (part && typeof part === "object" && "id" in part && typeof part.id === "string") {
      if (inner.kind === "list" && inner.item.kind === "object") {
        const index = rowIndex(engine, value, part.id, path);
        location = { node: inner.item, parent: value, key: index, value: value.get(index), entry: false };
      } else if (inner.kind === "tree") {
        const data = treeNode(value, part.id, path).data;
        location = { node: inner.item, key: part.id, value: data, entry: false };
      } else reject("Unknown schema path");
    } else if (part && typeof part === "object" && "key" in part && inner.kind === "record") {
      checkRecordKey(part.key);
      location = { node: inner.value, parent: value, key: part.key, value: value.get(part.key), entry: true };
    } else if (
      part &&
      typeof part === "object" &&
      "index" in part &&
      inner.kind === "list" &&
      inner.item.kind !== "object"
    ) {
      if (!isInt(part.index) || part.index < 0 || part.index >= value.length)
        reject(`List index out of range at ${JSON.stringify(path)}`);
      location = { node: inner.item, parent: value, key: part.index, value: value.get(part.index), entry: false };
    } else reject("Unknown schema path");
  }
  return location;
}
function rowIndex(engine: LoroDoc, list: LoroMovableList, id: string, path: Path) {
  let found: (string | number)[] | undefined;
  try {
    found = engine.getPathToContainer(id as ContainerID);
  } catch {}
  const parent = engine.getPathToContainer(list.id);
  const index = found?.at(-1);
  if (
    !found ||
    !parent ||
    typeof index !== "number" ||
    found.length !== parent.length + 1 ||
    parent.some((part, i) => found![i] !== part)
  )
    reject(`Unknown row ID: ${id} at ${JSON.stringify(path)}`);
  return index as number;
}
function treeNode(tree: LoroTree, id: string, path: Path): LoroTreeNode {
  let node: LoroTreeNode | undefined;
  try {
    if (tree.has(id as TreeID) && !tree.isNodeDeleted(id as TreeID)) node = tree.getNodeByID(id as TreeID);
  } catch {}
  return node ?? reject(`Unknown tree node ID: ${id} at ${JSON.stringify(path)}`);
}
/** Present value of a composite, rejecting absent optional values and record entries. */
function present(location: Location, path: Path) {
  if (location.value === undefined) reject(`Absent value at ${JSON.stringify(path)}; set it first`);
  return unwrap(location.node);
}
function range(start: unknown, end: unknown, length: number) {
  if (!isInt(start) || !isInt(end) || start < 0 || end > length || start >= end)
    reject("Expected a non-empty text range inside the text");
}
export function applyOperation(engine: LoroDoc, root: ObjectNode, op: Operation): InsertResult | void {
  if (!op || typeof op !== "object") reject("Invalid operation");
  const location = resolve(engine, root, op.path);
  const { node, parent, key, value } = location;
  switch (op.type) {
    case "set": {
      const scalar = unwrap(node);
      if (!isScalar(scalar))
        reject("set requires a scalar; use text.replace for text and assign for composites");
      validate(scalar, op.value);
      if (!parent) return reject("Unknown schema path");
      if (parent instanceof LoroMovableList) parent.set(key as number, op.value);
      else if (parent instanceof LoroMap) parent.set(key as string, op.value);
      else reject("Tree nodes are not scalars");
      return;
    }
    case "clear":
      if (node.kind !== "optional" && !location.entry)
        reject("Only optional fields and record entries can be cleared");
      if (!(parent instanceof LoroMap)) return reject("Only optional fields and record entries can be cleared");
      parent.delete(key as string);
      return;
    case "assign": {
      const target = unwrap(node);
      if (!parent) return reject("assign requires a field path");
      if (op.value === undefined) {
        if (node.kind !== "optional" && !location.entry) reject("Only optional fields can be cleared");
        (parent as LoroMap).delete(key as string);
        return;
      }
      validate(target, op.value);
      assertAssignable(target, op.value, value);
      if (parent instanceof LoroMovableList) parent.set(key as number, op.value as any);
      else write(parent as LoroMap, key as string, target, op.value, true);
      return;
    }
    case "text.replace":
    case "text.splice":
    case "text.mark":
    case "text.unmark": {
      const text = present(location, op.path);
      if (text.kind !== "text" && text.kind !== "richtext") reject(`${op.type} requires text`);
      const container = value as LoroText;
      if (op.type === "text.replace") {
        validate(text, op.value);
        container.update(op.value);
      } else if (op.type === "text.splice") {
        const length = container.length;
        if (!isInt(op.index) || !isInt(op.delete) || op.index < 0 || op.delete < 0 || op.index + op.delete > length)
          reject("Text splice is outside the text");
        if (typeof op.insert !== "string") reject("Text splice inserts a string");
        container.splice(op.index, op.delete, op.insert);
      } else {
        if (text.kind !== "richtext") return reject(`${op.type} requires rich text`);
        validateMark(text, op.key, op.type === "text.mark" ? op.value : null);
        range(op.start, op.end, container.length);
        if (op.type === "text.mark") container.mark({ start: op.start, end: op.end }, op.key, op.value);
        else container.unmark({ start: op.start, end: op.end }, op.key);
      }
      return;
    }
    case "increment": {
      const counter = present(location, op.path);
      if (counter.kind !== "counter") reject("increment requires a counter");
      validate(counter, op.value);
      (value as LoroCounter).increment(op.value);
      return;
    }
    case "insert":
    case "remove":
    case "move": {
      const target = present(location, op.path);
      if (target.kind === "list" && target.item.kind === "object") return rows(engine, value, target.item, op);
      if (target.kind === "list") return values(value, target.item as Scalar, op);
      if (target.kind === "tree") return tree(value, target.item, op);
      return reject("Operation requires a list or tree field");
    }
    default:
      reject("Unknown operation");
  }
}
/** Preflight the entire assignment before touching any live containers. */
function assertAssignable(node: ValueNode, input: any, existing: any): void {
  if (existing === undefined) return;
  if ((node.kind === "list" && node.item.kind === "object") || node.kind === "tree")
    reject("assign would recreate row identity; use insert, remove and move");
  if (node.kind === "object") {
    for (const [key, child] of Object.entries(node.properties))
      if (input[key] !== undefined) assertAssignable(unwrap(child), input[key], existing.get(key));
  } else if (node.kind === "record") {
    for (const [key, entry] of Object.entries(input))
      assertAssignable(node.value, entry, existing.get(key));
  }
}
type Structural = Extract<Operation, { type: "insert" | "remove" | "move" }>;
function rows(engine: LoroDoc, list: LoroMovableList, item: ObjectNode, op: Structural): InsertResult | void {
  const dest = (destination: unknown) => {
    const d = destination as Destination | undefined;
    if (
      !d ||
      typeof d !== "object" ||
      "parent" in d ||
      (typeof d.before === "string") === (typeof d.after === "string")
    )
      reject("Move requires exactly one before/after ID");
    return rowIndex(engine, list, (d!.before ?? d!.after)!, op.path) + (d!.after !== undefined ? 1 : 0);
  };
  if (op.type === "insert") {
    validate(item, op.value);
    const index = op.destination === undefined ? list.length : dest(op.destination);
    const row = list.insertContainer(index, new LoroMap());
    fill(row, item, op.value);
    return Object.freeze({ id: row.id });
  }
  if (typeof op.id !== "string") reject("Row operations require an ID");
  const from = rowIndex(engine, list, op.id!, op.path);
  if (op.type === "remove") return void list.delete(from, 1);
  if (op.type !== "move") return;
  const to = dest(op.destination);
  if (to === from || to === from + 1) return;
  list.move(from, to - (from < to ? 1 : 0));
}
function values(list: LoroMovableList, item: Scalar, op: Structural): void {
  const length = list.length;
  if (op.type === "insert") {
    validate(item, op.value);
    const index = op.index ?? length;
    if (!isInt(index) || index < 0 || index > length) reject("List index out of range");
    list.insert(index, op.value as any);
  } else if (op.type === "remove") {
    const count = op.count ?? 1;
    if (!isInt(op.index) || !isInt(count) || op.index < 0 || count < 1 || op.index + count > length)
      reject("List range out of range");
    list.delete(op.index!, count);
  } else if (op.type === "move") {
    if (!isInt(op.from) || !isInt(op.to) || op.from < 0 || op.to < 0 || op.from >= length || op.to >= length)
      reject("List index out of range");
    if (op.from !== op.to) list.move(op.from!, op.to!);
  }
}
function tree(tree: LoroTree, item: ObjectNode, op: Structural): InsertResult | void {
  const place = (destination: unknown): { parent?: TreeID; index: number } => {
    const d = destination as Destination | undefined;
    if (d === undefined) return { index: tree.roots().length };
    if (!d || typeof d !== "object") return reject("Invalid tree destination");
    const given = ["parent", "before", "after"].filter((k) => k in d);
    if (given.length !== 1) reject("Tree destination names exactly one of parent, before or after");
    if ("parent" in d) {
      if (d.parent === null) return { index: tree.roots().length };
      const parent = treeNode(tree, d.parent as string, op.path);
      return { parent: parent.id, index: parent.children()?.length ?? 0 };
    }
    const sibling = treeNode(tree, (d.before ?? d.after)!, op.path);
    return { parent: sibling.parent()?.id, index: sibling.index()! + (d.after !== undefined ? 1 : 0) };
  };
  if (op.type === "insert") {
    validate({ kind: "tree", item }, [op.value]);
    const { parent, index } = place(op.destination);
    return Object.freeze({ id: createTreeNode(tree, item, op.value as any, parent, index) });
  }
  if (typeof op.id !== "string") reject("Tree operations require a node ID");
  const node = treeNode(tree, op.id!, op.path);
  if (op.type === "remove") return void tree.delete(node.id);
  if (op.type !== "move") return;
  const d = op.destination as Destination | undefined;
  try {
    if (d && typeof d === "object" && typeof d.before === "string" && !("after" in d) && !("parent" in d))
      node.moveBefore(treeNode(tree, d.before, op.path));
    else if (d && typeof d === "object" && typeof d.after === "string" && !("before" in d) && !("parent" in d))
      node.moveAfter(treeNode(tree, d.after, op.path));
    else {
      const { parent } = place(d);
      const siblings = parent === undefined ? tree.roots() : tree.getNodeByID(parent)!.children() ?? [];
      tree.move(node.id, parent, siblings.filter((s) => s.id !== node.id).length);
    }
  } catch (error) {
    if (error instanceof OperationRejectedError) throw error;
    reject(`Tree move rejected: ${String(error)}`);
  }
}
function createTreeNode(
  tree: LoroTree,
  item: ObjectNode,
  value: Record<string, unknown>,
  parent: TreeID | undefined,
  index: number,
): TreeID {
  const { children, ...fields } = value;
  const node = tree.createNode(parent, index);
  fill(node.data, item, fields);
  (children as Record<string, unknown>[] | undefined)?.forEach((child, i) =>
    createTreeNode(tree, item, child, node.id, i),
  );
  return node.id;
}
const kinds = {
  text: "Text",
  richtext: "Text",
  counter: "Counter",
  object: "Map",
  record: "Map",
  list: "MovableList",
  tree: "Tree",
} as const;
const constructors = {
  Text: LoroText,
  Counter: LoroCounter,
  Map: LoroMap,
  MovableList: LoroMovableList,
  Tree: LoroTree,
} as const;
const mergeable = {
  Text: "ensureMergeableText",
  Counter: "ensureMergeableCounter",
  Map: "ensureMergeableMap",
  MovableList: "ensureMergeableMovableList",
  Tree: "ensureMergeableTree",
} as const;
/**
 * Replace the value at a map key. Absent composite children are created with
 * deterministic mergeable IDs when `lazy`, so peers that create the same
 * optional field or record entry concurrently merge instead of losing one side.
 */
function write(map: LoroMap, key: string, node: ValueNode, value: any, lazy: boolean): void {
  if (isScalar(node)) return void map.set(key, value);
  const kind = kinds[node.kind as keyof typeof kinds];
  const existing = map.get(key) as any;
  const container =
    existing?.kind?.() === kind
      ? existing
      : lazy && existing === undefined
        ? (map as any)[mergeable[kind]](key)
        : map.setContainer(key, new (constructors[kind] as any)());
  replace(container, node, value, lazy);
}
function replace(container: any, node: ValueNode, value: any, lazy: boolean): void {
  switch (node.kind) {
    case "text":
    case "richtext":
      if (container.toString() !== value) container.update(value);
      return;
    case "counter":
      if (value !== container.value) container.increment(value - container.value);
      return;
    case "object":
      for (const [key, child] of Object.entries(node.properties)) {
        if (value[key] === undefined) {
          if (container.get(key) !== undefined) container.delete(key);
        } else write(container, key, unwrap(child), value[key], lazy);
      }
      return;
    case "record":
      for (const key of container.keys()) if (!Object.hasOwn(value, key)) container.delete(key);
      for (const [key, entry] of Object.entries(value)) write(container, key, node.value, entry, true);
      return;
    case "list": {
      const list = container as LoroMovableList;
      if (node.item.kind === "object") {
        if (list.length) list.delete(0, list.length);
        for (const row of value) fill(list.insertContainer(list.length, new LoroMap()), node.item, row);
        return;
      }
      // Keep unchanged positions so concurrent edits elsewhere in the list survive.
      const shared = Math.min(list.length, value.length);
      for (let i = 0; i < shared; i++) if (list.get(i) !== value[i]) list.set(i, value[i]);
      if (list.length > value.length) list.delete(value.length, list.length - value.length);
      for (let i = shared; i < value.length; i++) list.insert(i, value[i]);
      return;
    }
    case "tree": {
      const tree = container as LoroTree;
      for (const root of tree.roots()) tree.delete(root.id);
      (value as any[]).forEach((node_, i) => createTreeNode(tree, node.item, node_, undefined, i));
    }
  }
}
/** Populate a new map; fixed fields use ordinary child containers. */
export function fill(map: LoroMap, node: ObjectNode, input: any): void {
  for (const [key, child] of Object.entries(node.properties))
    if (child.kind !== "optional" || input[key] !== undefined)
      write(map, key, unwrap(child), input[key], child.kind === "optional");
}
export type Register = (value: object, path: Path) => void;
/** Validates container kinds as well as values; a string register is not a LoroText. */
export function project(node: Node, value: any, previous?: any, path: Path = [], register?: Register): any {
  if (node.kind === "optional")
    return value === undefined ? undefined : project(node.inner, value, previous, path, register);
  if (isScalar(node)) {
    if (value !== null && typeof value === "object") throw new Error("Expected scalar value");
    validate(node, value);
    return value;
  }
  const kind = kinds[node.kind as keyof typeof kinds];
  if (value?.kind?.() !== kind) throw new Error(`Expected Loro${kind}`);
  switch (node.kind) {
    case "text":
      return value.toString();
    case "counter": {
      const n = value.value;
      validate(node, n);
      return n;
    }
    case "richtext": {
      const text = value.toString();
      const delta = value.toDelta();
      if (previous?.text === text && JSON.stringify(previous.delta) === JSON.stringify(delta)) return previous;
      return deepFreeze({ text, delta });
    }
    case "list":
      return node.item.kind === "object"
        ? projectRows(node.item, value, previous, path, register)
        : share(
            previous,
            value.toArray().map((v: unknown) => project(node.item, v)),
          );
    case "record": {
      const next: Record<string, unknown> = {};
      for (const key of value.keys()) {
        checkRecordKey(key);
        next[key] = project(node.value, value.get(key), previous?.[key], [...path, { key }], register);
      }
      return shareObject(previous, next, path, register);
    }
    case "tree":
      return projectTree(node.item, value, previous, path, register);
    case "object": {
      for (const key of value.keys())
        if (!Object.hasOwn(node.properties, key)) throw new Error(`Unknown stored field: ${key}`);
      const next: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.properties)) {
        const projected = project(child, value.get(key), previous?.[key], [...path, key], register);
        if (projected !== undefined) next[key] = projected;
      }
      return shareObject(previous, next, path, register);
    }
  }
}
/** Rows are reused by ID; `dirty` names post-change indices whose content changed. */
export function projectRows(
  item: ObjectNode,
  list: LoroMovableList,
  previous: any,
  path: Path,
  register?: Register,
  dirty?: Set<number>,
): any {
  const byID = new Map<string, any>((Array.isArray(previous) ? previous : []).map((row: any) => [row.$id, row]));
  const rows = (list.toArray() as LoroMap[]).map((row, index) => {
    const before = byID.get(row.id);
    if (before && dirty && !dirty.has(index)) return before;
    return projectRow(item, row, before, path, register);
  });
  return share(previous, rows);
}
export function projectRow(item: ObjectNode, row: LoroMap, before: any, path: Path, register?: Register) {
  if ((row as any)?.kind?.() !== "Map") throw new Error("Expected LoroMap");
  const rowPath = [...path, { id: row.id }];
  const next = project(item, row, before, rowPath, register);
  if (before && next === before) return before;
  const value = Object.freeze({ ...next, $id: row.id });
  register?.(value, rowPath);
  return value;
}
function projectTree(item: ObjectNode, tree: LoroTree, previous: any, path: Path, register?: Register) {
  const byID = new Map<string, any>();
  const index = (nodes: any) => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      byID.set(node.$id, node);
      index(node.children);
    }
  };
  index(previous);
  const visit = (nodes: LoroTreeNode[] | undefined, siblings: any): any =>
    share(
      siblings,
      (nodes ?? []).map((node) => {
        const before = byID.get(node.id);
        const nodePath = [...path, { id: node.id }];
        const fields = before ? (({ children: _c, $id: _i, ...rest }) => rest)(before) : undefined;
        const data = project(item, node.data, fields, nodePath, register);
        const children = visit(node.children(), before?.children);
        if (before && data === fields && children === before.children) return before;
        const value = Object.freeze({ ...data, $id: node.id, children });
        register?.(value, nodePath);
        return value;
      }),
    );
  return visit(tree.roots(), previous);
}
function share(previous: any, next: any[]) {
  return Array.isArray(previous) &&
    next.length === previous.length &&
    next.every((row: any, i: number) => row === previous[i])
    ? previous
    : Object.freeze(next);
}
function shareObject(previous: any, next: Record<string, unknown>, path: Path, register?: Register) {
  if (
    previous &&
    Object.keys(previous).filter((key) => key !== "$id").length === Object.keys(next).length &&
    Object.keys(next).every((key) => next[key] === previous[key])
  )
    return previous;
  const value = Object.freeze(next);
  register?.(value, path);
  return value;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
