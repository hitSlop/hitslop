/** JSON semantics in the guest: exact JS string/key equality, unordered objects,
 * ordered arrays, IEEE-754 numbers, and -0 equal to 0. Never parse via Foundation. */
export function equalJSON(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => equalJSON(value, b[i]))
    );
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && equalJSON((a as any)[key], (b as any)[key]))
  );
}
export function preservedJSON(source: string, output: string): boolean {
  try {
    return equalJSON(JSON.parse(source), JSON.parse(output));
  } catch {
    return false;
  }
}
