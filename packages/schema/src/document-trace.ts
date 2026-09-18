/** Optional host instrumentation. No clock or telemetry enters the evaluator. */
export type DocumentTrace = (stage: string, starting: boolean) => void;
export function traced<T>(trace: DocumentTrace | undefined, stage: string, work: () => T): T {
  trace?.(stage, true);
  try {
    return work();
  } finally {
    trace?.(stage, false);
  }
}
