import { readable, writable } from "svelte/store";
import type { Reference } from "@hitslop/schema/collections";

declare global { interface Window { __slopCollections?: { request(body: unknown): Promise<unknown> } } }
export async function call<A, R, K extends "query" | "mutation">(reference: Reference<A, R, K>, args: A): Promise<R> {
  if (!window.__slopCollections) throw new Error("Collections require the experimental host or slop dev --experimental-collections");
  return await window.__slopCollections.request({ collection: reference.collection, operation: reference.operation, args, ...(reference.kind === "mutation" ? { requestId: crypto.randomUUID() } : {}) }) as R;
}
/** Local observations; a query never creates a network subscription. */
export function query<A, R>(reference: Reference<A, R, "query">, args: A) {
  const error = writable<Error | null>(null);
  const store = readable<R | undefined>(undefined, set => {
    let alive = true, running = false, again = false;
    async function refresh() {
      if (running) { again = true; return; }
      running = true;
      do {
        again = false;
        try { const result = await call(reference, args); if (alive) { set(result); error.set(null); } }
        catch (e) { if (alive) error.set(e instanceof Error ? e : new Error(String(e))); }
      } while (alive && again);
      running = false;
    }
    window.addEventListener("slop-collections-change", refresh); void refresh();
    return () => { alive = false; window.removeEventListener("slop-collections-change", refresh); };
  });
  return { subscribe: store.subscribe, error: { subscribe: error.subscribe } };
}
export function mutation<A, R>(reference: Reference<A, R, "mutation">) {
  const pending = writable(false), error = writable<Error | null>(null); let active = 0;
  return { pending: { subscribe: pending.subscribe }, error: { subscribe: error.subscribe }, async mutate(args: A) {
    active++; pending.set(true); error.set(null);
    try { return await call(reference, args); }
    catch (e) { error.set(e instanceof Error ? e : new Error(String(e))); throw e; }
    finally { active--; pending.set(active > 0); }
  } };
}
