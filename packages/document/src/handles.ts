import type { Commands, Destination } from "./operations";
import type {
  Field,
  Input,
  ListNode,
  Node,
  ObjectNode,
  OptionalNode,
  Path,
  Scalar,
  Text,
} from "./schema";

export type InsertResult = { readonly id: string };
export type TextHandle = { replace(value: string): void };
export type Handle<N extends Node> =
  N extends ObjectNode<infer P>
    ? { readonly [K in keyof P]: Handle<P[K]> }
    : N extends ListNode<infer I>
      ? {
          item(id: string): Handle<I>;
          insert(value: Input<I>): InsertResult;
          remove(id: string): void;
          move(id: string, destination: Destination): void;
        }
      : N extends Text
        ? TextHandle
        : N extends OptionalNode
          ? { set(value: Exclude<Input<N>, undefined>): void; clear(): void }
          : N extends Scalar
            ? { set(value: Input<N>): void }
            : never;

// DOM adapters can observe text without making handles readable author state.
export interface TextObserver {
  beforeFlush?(draft: () => void): () => void;
  read(path: Path): string | undefined;
  subscribe(listener: () => void): () => void;
}
const textObservers = new WeakMap<TextHandle, { source: TextObserver; path: Path }>();
export function observeText(handle: TextHandle) {
  const observer = textObservers.get(handle);
  if (!observer) throw new Error("Text binding requires a live document text handle");
  return observer;
}

export function createHandles<N extends Node>(
  node: N,
  commands: Commands,
  observer?: TextObserver,
  path: Path = [],
): Handle<N> {
  const frozenPath = Object.freeze(
    path.map((part) => (typeof part === "string" ? part : Object.freeze({ ...part }))),
  ) as unknown as Path;
  const field = { node, path: frozenPath };
  let handle: object;
  if (node.kind === "object") {
    handle = Object.fromEntries(
      Object.entries(node.properties).map(([key, child]) => [
        key,
        createHandles(child, commands, observer, [...path, key]),
      ]),
    );
  } else if (node.kind === "list") {
    const list = field as Field<ListNode>;
    handle = {
      item: (id: string) => createHandles(node.item, commands, observer, [...path, { id }]),
      insert: (value: Input<ObjectNode>) => commands.insert(list, value),
      remove: (id: string) => commands.remove(list, id),
      move: (id: string, destination: Destination) => commands.move(list, id, destination),
    };
  } else if (node.kind === "text") {
    const text = { replace: (value: string) => commands.text(field as Field<Text>).replace(value) };
    if (observer) textObservers.set(text, { source: observer, path: frozenPath });
    handle = text;
  } else {
    handle = {
      set: (value: string | number | boolean) =>
        commands.set(field as Field<Scalar | OptionalNode>, value),
      ...(node.kind === "optional"
        ? { clear: () => commands.clear(field as Field<OptionalNode>) }
        : {}),
    };
  }
  return Object.freeze(handle) as Handle<N>;
}
