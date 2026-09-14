import { LoroDoc, LoroMap, LoroMovableList, LoroText, type VersionVector } from "loro-crdt/base64";
import type { Static, TSchema } from "typebox";
import { syncMapping, validateDocument, type SyncNode } from "@hitslop/schema/document";

export type DocumentValue<S extends TSchema> = Static<S> & Record<string, unknown>;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Draft<T> = T;

const clone = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isMap = (value: unknown): value is LoroMap => value instanceof LoroMap;
const isList = (value: unknown): value is LoroMovableList => value instanceof LoroMovableList;
const isText = (value: unknown): value is LoroText => value instanceof LoroText;
const asObject = (value: unknown): Record<string, Json> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Json> : {};
const asArray = (value: unknown): Json[] => Array.isArray(value) ? value : [];

const jsonValue = (value: unknown): Json => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    const out: Record<string, Json> = Object.create(null);
    for (const [key, child] of Object.entries(value)) out[key] = jsonValue(child);
    return out;
  }
  throw new Error("Values must be plain JSON");
};

const seedNode = (parent: LoroMap | LoroMovableList, at: string | number, mapping: SyncNode, value: unknown): void => {
  if (mapping.container === "text") {
    const text = parent instanceof LoroMap && typeof at === "string"
      ? parent.setContainer(at, new LoroText())
      : (parent as LoroMovableList).insertContainer(Number(at), new LoroText());
    if (typeof value === "string" && value.length > 0) text.insert(0, value);
    return;
  }
  if (mapping.container === "map" || mapping.container === "record") {
    const map = typeof at === "string" && parent instanceof LoroMap
      ? parent.setContainer(at, new LoroMap())
      : (parent as LoroMovableList).insertContainer(Number(at), new LoroMap());
    seedMap(map, mapping, value);
    return;
  }
  if (mapping.container === "movable-list") {
    const list = typeof at === "string" && parent instanceof LoroMap
      ? parent.setContainer(at, new LoroMovableList())
      : (parent as LoroMovableList).insertContainer(Number(at), new LoroMovableList());
    for (const [index, item] of asArray(value).entries()) seedNode(list, index, mapping.item, item);
    return;
  }
  if (parent instanceof LoroMap && typeof at === "string") parent.set(at, jsonValue(value) as never);
  else (parent as LoroMovableList).insert(Number(at), jsonValue(value) as never);
};

const seedMap = (map: LoroMap, mapping: SyncNode, value: unknown): void => {
  const object = asObject(value);
  if (mapping.container === "record") {
    for (const [key, child] of Object.entries(object)) seedNode(map, key, mapping.values, child);
    return;
  }
  if (mapping.container !== "map") throw new Error("expected map mapping");
  const known = new Set(Object.keys(mapping.fields));
  for (const [key, field] of Object.entries(mapping.fields)) seedNode(map, key, field, object[key]);
  for (const [key, child] of Object.entries(object)) {
    if (!known.has(key)) map.set(key, jsonValue(child) as never);
  }
};

const itemId = (item: unknown, key: string): string | undefined => {
  if (isMap(item)) {
    const value = item.get(key);
    return typeof value === "string" ? value : undefined;
  }
  const object = asObject(item);
  return typeof object[key] === "string" ? object[key] as string : undefined;
};

const indexOfId = (list: LoroMovableList, key: string, id: string): number => {
  for (let index = 0; index < list.length; index++) {
    if (itemId(list.get(index), key) === id) return index;
  }
  return -1;
};

const applyNode = (holder: LoroMap | LoroMovableList, at: string | number, mapping: SyncNode, before: unknown, after: unknown): void => {
  if (same(before, after)) return;
  if (mapping.container === "text") {
    const current = typeof at === "string" && holder instanceof LoroMap ? holder.get(at) : (holder as LoroMovableList).get(Number(at));
    if (!isText(current)) throw new Error("expected text container");
    current.update(typeof after === "string" ? after : "");
    return;
  }
  if (mapping.container === "map" || mapping.container === "record") {
    const current = typeof at === "string" && holder instanceof LoroMap ? holder.get(at) : (holder as LoroMovableList).get(Number(at));
    if (!isMap(current)) throw new Error("expected map container");
    applyMap(current, mapping, before, after);
    return;
  }
  if (mapping.container === "movable-list") {
    const current = typeof at === "string" && holder instanceof LoroMap ? holder.get(at) : (holder as LoroMovableList).get(Number(at));
    if (!isList(current)) throw new Error("expected list container");
    applyList(current, mapping, before, after);
    return;
  }
  if (holder instanceof LoroMap && typeof at === "string") holder.set(at, jsonValue(after) as never);
  else (holder as LoroMovableList).set(Number(at), jsonValue(after) as never);
};

const applyMap = (map: LoroMap, mapping: SyncNode, before: unknown, after: unknown): void => {
  const previous = asObject(before);
  const next = asObject(after);
  if (mapping.container === "record") {
    for (const key of map.keys() as string[]) {
      if (!(key in next)) map.delete(key);
    }
    for (const [key, value] of Object.entries(next)) {
      if (map.get(key) === undefined) seedNode(map, key, mapping.values, value);
      else applyNode(map, key, mapping.values, previous[key], value);
    }
    return;
  }
  if (mapping.container !== "map") throw new Error("expected map mapping");
  const known = new Set(Object.keys(mapping.fields));
  for (const [key, field] of Object.entries(mapping.fields)) {
    applyNode(map, key, field, previous[key], next[key]);
  }
  for (const key of map.keys() as string[]) {
    if (!known.has(key) && !(key in next)) map.delete(key);
  }
  for (const [key, value] of Object.entries(next)) {
    if (known.has(key)) continue;
    if (!same(previous[key], value)) map.set(key, jsonValue(value) as never);
  }
};

const applyList = (list: LoroMovableList, mapping: Extract<SyncNode, { container: "movable-list" }>, before: unknown, after: unknown): void => {
  const previous = asArray(before);
  const next = asArray(after);
  const previousIds = previous.map(item => itemId(item, mapping.key)).filter((id): id is string => !!id);
  const nextIds = next.map(item => itemId(item, mapping.key)).filter((id): id is string => !!id);
  const nextById = new Map(next.map(item => [itemId(item, mapping.key), item]));

  for (const id of previousIds) {
    if (nextIds.includes(id)) continue;
    const index = indexOfId(list, mapping.key, id);
    if (index >= 0) list.delete(index, 1);
  }

  for (const [index, item] of next.entries()) {
    const id = itemId(item, mapping.key);
    if (!id) throw new Error("list item is missing its id");
    if (previousIds.includes(id)) continue;
    seedNode(list, Math.min(index, list.length), mapping.item, item);
  }

  for (const id of nextIds) {
    if (!previousIds.includes(id)) continue;
    const index = indexOfId(list, mapping.key, id);
    if (index < 0) continue;
    applyNode(list, index, mapping.item, previous.find(item => itemId(item, mapping.key) === id), nextById.get(id));
  }

  for (const [target, id] of nextIds.entries()) {
    const from = indexOfId(list, mapping.key, id);
    if (from >= 0 && from !== target) list.move(from, target);
  }
};

export class Replica<S extends TSchema> {
  readonly schema: S;
  readonly mapping: SyncNode;
  readonly doc: LoroDoc;

  constructor(options: { schema: S; peerId: string; initial?: DocumentValue<S>; snapshot?: Uint8Array }) {
    this.schema = options.schema;
    this.mapping = syncMapping(options.schema);
    if (this.mapping.container !== "map") throw new Error("schema root must be S.Document");
    this.doc = new LoroDoc();
    this.doc.setPeerId(BigInt(options.peerId));
    if (options.snapshot) this.doc.import(options.snapshot);
    else {
      if (options.initial === undefined) throw new Error("Replica requires initial JSON or a snapshot");
      validateDocument(options.schema, options.initial);
      seedMap(this.doc.getMap("data"), this.mapping, options.initial);
    }
    validateDocument(this.schema, this.current());
  }

  current(): DocumentValue<S> {
    return jsonValue(this.doc.getMap("data").toJSON()) as DocumentValue<S>;
  }

  update(mutate: (draft: Draft<DocumentValue<S>>) => void): DocumentValue<S> {
    const before = this.current();
    const draft = clone(before);
    mutate(draft);
    validateDocument(this.schema, draft);
    jsonValue(draft);
    const staged = this.doc.fork();
    staged.setPeerId(this.doc.peerIdStr);
    applyMap(staged.getMap("data"), this.mapping, before, draft);
    validateDocument(this.schema, staged.getMap("data").toJSON());
    // This staged local edit was validated above; no concurrent JS can intervene.
    this.doc.import(staged.export({ mode: "update", from: this.doc.oplogVersion() }));
    return this.current();
  }

  applyAt(frontiers: ReturnType<LoroDoc["oplogFrontiers"]>, edited: DocumentValue<S>): void {
    validateDocument(this.schema, edited);
    const branch = this.doc.forkAt(frontiers);
    applyMap(branch.getMap("data"), this.mapping, branch.getMap("data").toJSON(), edited);
    validateDocument(this.schema, branch.getMap("data").toJSON());
    this.importUpdates(branch.export({ mode: "update", from: this.doc.oplogVersion() }));
  }

  exportUpdates(from?: VersionVector): Uint8Array {
    return from ? this.doc.export({ mode: "update", from }) : this.doc.export({ mode: "update" });
  }

  exportSnapshot(): Uint8Array {
    return this.doc.export({ mode: "snapshot" });
  }

  importUpdates(bytes: Uint8Array): void {
    const staged = this.doc.fork();
    staged.import(bytes);
    validateDocument(this.schema, staged.getMap("data").toJSON());
    this.doc.import(bytes);
  }
}

export const exchange = (left: Replica<TSchema>, right: Replica<TSchema>): void => {
  const fromLeft = left.exportUpdates(right.doc.oplogVersion());
  const fromRight = right.exportUpdates(left.doc.oplogVersion());
  right.importUpdates(fromLeft);
  left.importUpdates(fromRight);
};
