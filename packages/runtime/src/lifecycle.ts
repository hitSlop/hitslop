const flushers = new Map<() => Promise<void>, string>();

/** Adapters register here so a native close/duplicate can await every writer. */
export function registerFlush(name: string, handler: () => Promise<void>): () => void {
  flushers.set(handler, name);
  return () => {
    flushers.delete(handler);
  };
}
export async function flush(): Promise<void> {
  const entries = [...flushers];
  const outcomes = await Promise.allSettled(
    entries.map(([handler]) => Promise.resolve().then(handler)),
  );
  const failures = outcomes.flatMap((outcome, index) =>
    outcome.status === "rejected"
      ? [new Error(`${entries[index]![1]}: ${String(outcome.reason)}`)]
      : [],
  );
  try {
    if (typeof window !== "undefined") await window.slop?.flush?.();
  } catch (error) {
    failures.push(new Error(`host: ${String(error)}`));
  }
  if (failures.length)
    throw new AggregateError(failures, failures.map((error) => error.message).join("; "));
}
if (typeof window !== "undefined") window.__hitslopFlush = flush;
declare global {
  interface Window {
    __hitslopFlush?: () => Promise<void>;
  }
}
