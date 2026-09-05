/** Prevent a slow response from replacing a newer result or a disposed view. */
export class LatestTask {
  private generation = 0;
  private disposed = false;

  async run<T>(operation: () => Promise<T>, adopt: (value: T) => void, fail: (error: unknown) => void, finish: () => void): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.generation;
    const current = () => !this.disposed && generation === this.generation;
    try { const value = await operation(); if (current()) adopt(value); }
    catch (error) { if (current()) fail(error); }
    finally { if (current()) finish(); }
  }
  invalidate(): void { this.generation += 1; }
  dispose(): void { this.disposed = true; this.invalidate(); }
}
