// Test harness over the compiled Rust WASM artifact and the production renderer SDK.
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { OwnerDocument } from "../../packages/document/src/owner/document";
import {
  fromDescriptor,
  schemaKey,
  type Definition,
  type ObjectNode,
} from "../../packages/document/src/schema";
import type { ByteStore } from "../../packages/document/src/storage";
export async function loadCoreReader(root: string) {
  const wasm = await import(pathToFileURL(join(root, "core/hitslop_core_wasm.js")).href);
  wasm.initSync({ module: await Bun.file(join(root, "core/hitslop_core_wasm_bg.wasm")).bytes() });
  return {
    contract: 4,
    fromDescriptor,
    Document: {
      async open<N extends ObjectNode>(
        definition: Definition<N>,
        store: ByteStore,
        initial: unknown,
      ) {
        let core: any;
        try {
          const loaded = await store.load();
          const schema = schemaKey(definition.descriptor);
          if (loaded.checkpoint && loaded.schemaKey !== schema)
            throw new Error("Schema differs from saved state");
          core = loaded.checkpoint
            ? wasm.WasmDocument.open(schema, loaded.checkpoint)
            : wasm.WasmDocument.create(schema, JSON.stringify(initial));
          for (const update of loaded.updates) core.import_updates(update);
          let generation = loaded.generation;
          if (!loaded.checkpoint)
            generation = await store.checkpoint(generation, core.checkpoint(), schema);
          let saved = core.version();
          let closed = false;
          const flush = async () => {
            if (core.version() !== saved) {
              const version = core.version();
              generation = await store.append(generation, [core.export_since(saved)]);
              saved = version;
            }
          };
          const doc = await OwnerDocument.open(definition, {
            state: async () => JSON.parse(core.snapshot()),
            apply: async ({ batch }) => JSON.parse(core.apply(JSON.stringify(batch))),
            text: async (request) => JSON.parse(core.text(JSON.stringify(request))),
            releaseDraft: async (id) => core.release_draft(id),
            flush,
          });
          return Object.assign(doc, {
            version: () => core.version(),
            applyAll: async (intents: unknown[]) =>
              doc.receive(JSON.parse(core.command_current(JSON.stringify({ intents })))),
            importUpdates: async (bytes: Uint8Array) =>
              doc.receive(JSON.parse(core.import_updates(bytes))),
            exportSnapshot: () => core.checkpoint(),
            exportUpdates: (version?: string) =>
              version ? core.export_since(version) : core.checkpoint(),
            importJSON: () => {
              throw new Error(
                "unsupported_operation: JSON replacement is not supported in contract 4 yet",
              );
            },
            compact: async () => {
              await doc.flush();
              generation = await store.checkpoint(generation, core.checkpoint(), schema);
              saved = core.version();
            },
            close: async () => {
              if (!closed) {
                await doc.flush();
                await store.close();
                core.free();
                closed = true;
              }
            },
          });
        } catch (error) {
          core?.free();
          await store.close();
          throw error;
        }
      },
    },
  };
}
