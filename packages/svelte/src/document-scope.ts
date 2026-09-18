import type { RuntimeIssue } from "@hitslop/runtime";

/** Shared by the wrapper and companion adapters, never a second data store. */
export class DocumentScope {
  private listeners = new Set<(issue: RuntimeIssue) => void>();
  private latest: RuntimeIssue | undefined;
  resetRender: (() => void) | undefined;
  renderError: string | undefined;

  report(issue: RuntimeIssue) {
    if (!this.listeners.size) this.latest = issue;
    for (const listener of this.listeners) listener(issue);
  }
  subscribe(listener: (issue: RuntimeIssue) => void) {
    this.listeners.add(listener);
    const latest = this.latest;
    this.latest = undefined;
    if (latest) listener(latest);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const scopes = new WeakMap<object, DocumentScope>();
export function documentScope(store: object): DocumentScope {
  let scope = scopes.get(store);
  if (!scope) scopes.set(store, (scope = new DocumentScope()));
  return scope;
}
