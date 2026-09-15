import type { DocumentRuntime, DocumentSession, DocumentValue, DocumentIO } from "@hitslop/schema/document-runtime";
import type { TSchema } from "typebox";
import { DocumentEngine } from "./document.js";
import { documentRuntimeVersion } from "./runtime-release.js";

export { documentRuntimeVersion } from "./runtime-release.js";
export const documentRuntime = Object.freeze<DocumentRuntime>({
  version: documentRuntimeVersion,
  async open<S extends TSchema>(options: { schema: S; initial: DocumentValue<S>; io: DocumentIO }): Promise<DocumentSession<S>> {
    const engine = await DocumentEngine.open<S>(options);
    return Object.freeze({
      get current() { return engine.current; },
      get state() { return engine.state; },
      get dataVersion() { return engine.dataVersion; },
      subscribe: callback => engine.subscribe(callback),
      change: mutate => engine.change(mutate),
      flush: () => engine.flush(),
      externalChanged: () => engine.externalChanged(),
      resolveReview: (token, action) => engine.resolveReview(token, action),
      sharingSnapshot: () => engine.sharingSnapshot(),
      receiveShared: value => engine.receiveShared(value),
      independentCopy: () => engine.independentCopy(),
    } satisfies DocumentSession<typeof options.schema>);
  },
  sharedSeed: (schema, value) => DocumentEngine.sharedSeed(schema, value),
});
