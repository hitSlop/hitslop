import { ChangeSchema } from "@hitslop/schema/bridge";
import { validate } from "@hitslop/schema/validation";
import type { SlopChange } from "./types.js";

export function dispatchChange(value: unknown, listeners: Record<SlopChange["kind"], Set<(event: SlopChange) => void>>, report: (error: unknown) => void): void {
  let event: SlopChange;
  try { event = validate(ChangeSchema, value); }
  catch (error) { report(error); return; }
  for (const callback of [...listeners[event.kind]]) {
    try { callback(event); } catch (error) { report(error); }
  }
}
