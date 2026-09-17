import type { createDemo } from "./demo.svelte.ts";
import type { Op, Result } from "./protocol.ts";
declare global {
  interface Window {
    spike?: {
      demo: ReturnType<typeof createDemo>;
      ready(): Promise<void>;
      remote(ops: Op[]): Result;
      benchmark(rows?: number, samples?: number): Promise<{ rows: number; bytes: number; samples: number; commandToDOMMedianMs: number; p95Ms: number }>;
    };
  }
}
export {};
