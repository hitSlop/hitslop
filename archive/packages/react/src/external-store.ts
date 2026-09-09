// Minimal base for `useSyncExternalStore`. Each store keeps one immutable
// data snapshot and replaces it wholesale so React can compare by identity.
export abstract class ExternalStore<S extends object> {
  private listeners = new Set<() => void>();
  private snapshot: S;

  constructor(initial: S) {
    this.snapshot = initial;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly getSnapshot = (): S => this.snapshot;

  protected patch(partial: Partial<S>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.listeners.forEach((listener) => listener());
  }
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
