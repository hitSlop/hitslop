import { OperationRejectedError } from "./errors";
export { OperationRejectedError } from "./errors";
/** v1 descriptors are data. Neither the host nor CLI evaluates authored callbacks. */
export type Text = { kind: "text" };
export type StringNode = { kind: "string" };
export type NumberNode = { kind: "number" };
export type BooleanNode = { kind: "boolean" };
export type EnumNode<V extends readonly string[] = readonly string[]> = { kind: "enum"; values: V };
export type Scalar = StringNode | NumberNode | BooleanNode | EnumNode;
export interface OptionalNode<S extends Scalar = Scalar> {
  kind: "optional";
  inner: S;
}
export interface ObjectNode<P extends Record<string, Node> = Record<string, Node>> {
  kind: "object";
  properties: P;
}
export interface ListNode<I extends ObjectNode = ObjectNode> {
  kind: "list";
  item: I;
}
export type Node = Scalar | OptionalNode | Text | ObjectNode | ListNode;
type OptionalKeys<P extends Record<string, Node>> = {
  [K in keyof P]: P[K] extends OptionalNode ? K : never;
}[keyof P];
type ObjectInput<P extends Record<string, Node>> = {
  [K in Exclude<keyof P, OptionalKeys<P>>]: Input<P[K]>;
} & { [K in OptionalKeys<P>]?: Input<P[K]> };
type ObjectValue<P extends Record<string, Node>> = {
  readonly [K in Exclude<keyof P, OptionalKeys<P>>]: Value<P[K]>;
} & { readonly [K in OptionalKeys<P>]?: Value<P[K]> };
export type Value<N extends Node> = N extends Text | StringNode
  ? string
  : N extends NumberNode
    ? number
    : N extends BooleanNode
      ? boolean
      : N extends EnumNode<infer V>
        ? V[number]
        : N extends OptionalNode<infer S>
          ? Value<S> | undefined
          : N extends ListNode<infer I>
            ? ReadonlyArray<Value<I> & { readonly $id: string }>
            : N extends ObjectNode<infer P>
              ? ObjectValue<P>
              : never;
export type Input<N extends Node> =
  N extends ListNode<infer I>
    ? Input<I>[]
    : N extends ObjectNode<infer P>
      ? ObjectInput<P>
      : Value<N>;
export type Path = (string | { id: string })[];
export type Field<N extends Node> = { readonly path: Path; readonly node: N };
export type Fields<N extends Node> = Field<N> &
  (N extends ObjectNode<infer P>
    ? { [K in keyof P]: Fields<P[K]> }
    : N extends ListNode<infer I>
      ? { item(id: string): Fields<I> }
      : {});
export type Descriptor = { format: 1; root: ObjectNode };
export type Definition<N extends ObjectNode> = { descriptor: Descriptor; fields: Fields<N> };
export const s = {
  text: (): Text => ({ kind: "text" }),
  string: (): StringNode => ({ kind: "string" }),
  number: (): NumberNode => ({ kind: "number" }),
  boolean: (): BooleanNode => ({ kind: "boolean" }),
  enum: <const V extends readonly [string, ...string[]]>(values: V): EnumNode<V> => ({
    kind: "enum",
    values,
  }),
  optional: <S extends Scalar>(inner: S): OptionalNode<S> => ({ kind: "optional", inner }),
  object: <P extends Record<string, Node>>(properties: P): ObjectNode<P> => ({
    kind: "object",
    properties,
  }),
  list: <I extends ObjectNode>(item: I): ListNode<I> => ({ kind: "list", item }),
};
export function defineDocument<P extends Record<string, Node>>(
  properties: P,
): Definition<ObjectNode<P>> {
  return fromDescriptor({ format: 1, root: s.object(properties) }) as Definition<ObjectNode<P>>;
}
export function fromDescriptor(input: Descriptor): Definition<ObjectNode> {
  const descriptor = JSON.parse(JSON.stringify(input)) as Descriptor;
  if (descriptor.format !== 1) throw new Error("Unsupported schema format");
  checkNode(descriptor.root, 0);
  if (descriptor.root.kind !== "object") throw new Error("Document root must be an object");
  const build = (node: Node, path: Path): any => {
    const field: any = { node, path: Object.freeze(path) };
    if (node.kind === "object")
      for (const [key, child] of Object.entries(node.properties))
        field[key] = build(child, [...path, key]);
    if (node.kind === "list") field.item = (id: string) => build(node.item, [...path, { id }]);
    return Object.freeze(field);
  };
  freeze(descriptor);
  return Object.freeze({ descriptor, fields: build(descriptor.root, []) });
}
function freeze(value: any) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}
export const isScalar = (node: Node): node is Scalar =>
  ["string", "number", "boolean", "enum"].includes(node.kind);
function checkNode(node: Node, depth: number): void {
  if (!node || depth > 16) throw new Error("Invalid/deep schema");
  const keys =
    node.kind === "object"
      ? ["kind", "properties"]
      : node.kind === "list"
        ? ["kind", "item"]
        : node.kind === "optional"
          ? ["kind", "inner"]
          : node.kind === "enum"
            ? ["kind", "values"]
            : ["kind"];
  if (Object.keys(node).some((k) => !keys.includes(k))) throw new Error("Unknown schema option");
  if (node.kind === "text" || ["string", "number", "boolean"].includes(node.kind)) return;
  if (node.kind === "enum") {
    if (
      !Array.isArray(node.values) ||
      !node.values.length ||
      node.values.some((v) => typeof v !== "string") ||
      new Set(node.values).size !== node.values.length
    )
      throw new Error("Enum requires unique string values");
    return;
  }
  if (node.kind === "optional") {
    if (!node.inner || !isScalar(node.inner)) throw new Error("Only scalars may be optional");
    return checkNode(node.inner, depth + 1);
  }
  if (node.kind === "list") {
    if (node.item?.kind !== "object") throw new Error("Lists require object rows");
    return checkNode(node.item, depth + 1);
  }
  if (node.kind !== "object" || !node.properties || Array.isArray(node.properties))
    throw new Error("Invalid schema node");
  for (const [key, child] of Object.entries(node.properties)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) ||
      ["path", "node", "item", "constructor", "prototype"].includes(key)
    )
      throw new Error(`Reserved/invalid field: ${key}`);
    checkNode(child, depth + 1);
  }
}
export function validate(node: Node, value: unknown): void {
  if (node.kind === "optional") {
    if (value !== undefined) validate(node.inner, value);
    return;
  }
  if (node.kind === "text" || node.kind === "string") {
    if (typeof value !== "string") throw new OperationRejectedError("Expected string");
  } else if (node.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new OperationRejectedError("Expected finite number");
  } else if (node.kind === "boolean") {
    if (typeof value !== "boolean") throw new OperationRejectedError("Expected boolean");
  } else if (node.kind === "enum") {
    if (typeof value !== "string" || !node.values.includes(value))
      throw new OperationRejectedError("Unknown enum value");
  } else if (node.kind === "list") {
    if (!Array.isArray(value)) throw new OperationRejectedError("Expected list");
    for (const item of value) validate(node.item, item);
  } else {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new OperationRejectedError("Expected object");
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record))
      if (!Object.hasOwn(node.properties, key))
        throw new OperationRejectedError(`Unknown field: ${key}`);
    for (const [key, child] of Object.entries(node.properties)) validate(child, record[key]);
  }
}
export function canonicalJSON(value: unknown): string {
  const canonical = (v: any): any =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canonical(v[k])]),
          )
        : v;
  return JSON.stringify(canonical(value));
}
export const schemaKey = (descriptor: Descriptor) => canonicalJSON(descriptor);
