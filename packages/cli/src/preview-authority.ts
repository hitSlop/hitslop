import { MemoryAuthority } from "@hitslop/schema/document-authority";
import type { JSONValue } from "@hitslop/schema/document-protocol";
import type { TSchema } from "typebox";

// Bundled into disposable browser previews. Never reads or writes a disk store.
Object.assign(window, {
  __hitslopCreatePreviewAuthority(schema: TSchema, initial: JSONValue) {
    return new MemoryAuthority(schema, initial);
  },
});
