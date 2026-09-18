import type { DocumentMapping } from "@hitslop/schema/document";

/** Immutable confirmed snapshots, with row identity preserved across insertions and moves. */
export function reconcile(previous: unknown, next: unknown, mapping?: DocumentMapping): unknown {
  if (previous === next) return previous;
  if (!next || typeof next !== "object") return next;
  if (Array.isArray(next)) {
    const old = Array.isArray(previous) ? previous : [];
    const list = mapping?.container === "list" ? mapping : undefined;
    const keyed = list ? new Map(old.map((row) => [row?.[list.key], row])) : undefined;
    const children = next.map((child, index) =>
      reconcile(keyed ? keyed.get(child?.[list!.key]) : old[index], child, list?.item),
    );
    return Array.isArray(previous) &&
      old.length === children.length &&
      children.every((child, index) => child === old[index])
      ? previous
      : Object.freeze(children);
  }
  const old =
    previous && typeof previous === "object" && !Array.isArray(previous)
      ? (previous as Record<string, unknown>)
      : undefined;
  const entries = Object.entries(next).map(
    ([key, child]) =>
      [
        key,
        reconcile(
          old && Object.hasOwn(old, key) ? old[key] : undefined,
          child,
          mapping?.container === "map"
            ? mapping.fields[key]
            : mapping?.container === "record"
              ? mapping.values
              : undefined,
        ),
      ] as const,
  );
  return old &&
    Object.keys(old).length === entries.length &&
    entries.every(([key, child]) => Object.hasOwn(old, key) && old[key] === child)
    ? previous
    : Object.freeze(Object.fromEntries(entries));
}
