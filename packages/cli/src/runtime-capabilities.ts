import { Check } from "typebox/value";
import { RuntimeCapabilitiesSchema } from "@hitslop/schema/runtime";

export function supportsRuntime(value: unknown, contract: number, revision: number): boolean {
  return (
    Check(RuntimeCapabilitiesSchema, value) &&
    value.runtimes.some(
      (runtime) => runtime.runtimeContract === contract && runtime.runtimeRevision >= revision,
    )
  );
}
