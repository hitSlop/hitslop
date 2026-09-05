const flushers = new Set<() => Promise<void>>();

/** Adapters register here so a native close/duplicate can await reactive writes. */
export function registerFlush(handler: () => Promise<void>): () => void {
  flushers.add(handler);
  return () => { flushers.delete(handler); };
}

export async function flush(): Promise<void> {
  await Promise.all([...flushers].map((handler) => handler()));
  if (typeof window !== "undefined") await window.slop?.flush?.();
}

if (typeof window !== "undefined") window.__hitslopFlush = flush;

declare global { interface Window { __hitslopFlush?: () => Promise<void> } }
