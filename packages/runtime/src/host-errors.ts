import type { BridgeParams } from "@hitslop/schema/bridge";

export type ErrorReport = {
  id: string;
  message: string;
  details?: string;
  action?: { label: string; run: () => Promise<void> };
  dismissible?: boolean;
};
type Entry = { value: ErrorReport; revision: number; busy: boolean };
const entries = new Map<string, Entry>();
const instance = crypto.randomUUID();
let revision = 0;
let delivery = Promise.resolve();
function send(work: () => Promise<unknown>) {
  delivery = delivery.then(work).then(() => undefined, error => { console.error("Host error reporting failed", error); });
}
function publish(entry: Entry) {
  const value: BridgeParams<"errors.report"> = {
    instance, id: entry.value.id, revision: entry.revision, message: entry.value.message,
    details: entry.value.details ?? "", action: entry.value.action?.label ?? null,
    dismissible: entry.value.dismissible ?? true, busy: entry.busy,
  };
  send(() => window.slop!.errors.report(value));
}
export const errors = {
  report(value: ErrorReport): void {
    const entry = { value, revision: ++revision, busy: false };
    entries.set(value.id, entry); publish(entry);
  },
  clear(id: string): void {
    entries.delete(id);
    const current = ++revision;
    send(() => window.slop!.errors.clear({ instance, id, revision: current }));
  },
};
/** Only the host invokes actions; callbacks never cross the bridge. */
export async function performHostAction(id: string, revision: number, actionInstance: string, dismiss = false): Promise<boolean> {
  if (actionInstance !== instance) return false;
  const entry = entries.get(id);
  if (!entry || entry.revision !== revision || entry.busy) return false;
  if (dismiss) {
    if (entry.value.dismissible === false) return false;
    errors.clear(id); return true;
  }
  if (!entry.value.action) return false;
  entry.busy = true; publish(entry);
  try {
    await entry.value.action.run();
    if (entries.get(id) === entry) errors.clear(id);
    return true;
  } catch (error) {
    if (entries.get(id) === entry) {
      entry.busy = false;
      entry.value = { ...entry.value, details: error instanceof Error ? error.message : String(error) };
      publish(entry);
    }
    return false;
  }
}
declare global { interface Window { __hitslopAction?: typeof performHostAction } }
if (typeof window !== "undefined") window.__hitslopAction = performHostAction;
