import { getContext } from "svelte";
export type SlopDocument = { flush(): Promise<void> };
export const slopContext = Symbol("hitslop.slop");
/** Access the facade passed to the nearest Slop boundary; it owns no new session. */
export function useSlop<T extends SlopDocument = SlopDocument>(): T {
  const document = getContext<T>(slopContext);
  if (!document) throw new Error("useSlop requires a Slop boundary");
  return document;
}
