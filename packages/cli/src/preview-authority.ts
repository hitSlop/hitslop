import { installPresentationStage } from "@hitslop/runtime/presentation";
Object.assign(window, { __hitslopInstallPresentationStage: installPresentationStage });
import { MemoryAuthority } from "@hitslop/document-engine/web";
import type { JSONValue } from "@hitslop/schema/document-protocol";
import type { TSchema } from "typebox";

// Bundled into disposable browser previews. Never reads or writes a disk store.
Object.assign(window, {
  __hitslopCreatePreviewAuthority(schema: TSchema, initial: JSONValue) {
    return new MemoryAuthority(schema, initial);
  },
});
