import { documentScope } from "./document-scope.js";
import type { Attachment } from "svelte/attachments";
import { paths, pathInfo, type Path } from "@hitslop/schema/document";
import { flushDocumentWriters } from "./document-lifecycle.js";
import type { Static, TSchema } from "typebox";
import { onDestroy, tick } from "svelte";
import { ready } from "@hitslop/runtime";
import {
  createDocumentController,
  registerFlush,
  type Controller,
  type Mutations,
  type MutationResult,
} from "@hitslop/runtime/adapter";
import { TextDrafts, textAttachment } from "./document-text.js";
import type { Address, PathValue } from "@hitslop/schema/document";

export type CreateDocumentOptions<S extends TSchema> = { schema: S; initial: NoInfer<Static<S>> };

export type SlopDocument<S extends TSchema> = Mutations<Promise<MutationResult>> & {
  readonly fields: Path<S>;
  isPending(path: Address): boolean;
  readonly data: Controller<S>["data"];
  readonly revision: number;
  readonly authority: string | undefined;
  readonly isLoading: boolean;
  readonly pending: number;
  readonly error: Controller<S>["error"];
  readonly connected: boolean;
  readonly canWrite: boolean;
  readonly hasUnknownOutcome: boolean;
  transaction(callback: (tx: Mutations<void>) => void): Promise<MutationResult>;
  text<P extends Address>(
    path: P & (PathValue<P> extends string ? unknown : never),
  ): Attachment<HTMLTextAreaElement | HTMLInputElement>;
  flush(): Promise<void>;
  destroy(): Promise<void>;
};

export function createDocument<S extends TSchema>(
  options: CreateDocumentOptions<S>,
): SlopDocument<S> {
  const controller = createDocumentController(options);
  const drafts = new TextDrafts(controller);
  const attachText = textAttachment(drafts);
  let data = $state.raw(controller.data);
  const read = () => ({
    authority: controller.authority,
    revision: controller.revision,
    isLoading: controller.isLoading,
    pending: controller.pending,
    error: controller.error,
    connected: controller.connected,
    canWrite: controller.canWrite,
    hasUnknownOutcome: controller.hasUnknownOutcome,
    retainedDrafts: drafts.retained,
  });
  let status = $state.raw(read());
  const update = () => {
    data = controller.data;
    status = read();
  };
  const unstore = controller.subscribe(update),
    undrafts = drafts.subscribe(update);
  let disposed = false;
  async function flush() {
    const result = await controller.flush();
    if (!result.ok) throw new Error(result.error.message);
  }
  // Native recovery UI can inspect/copy retained text and explicitly retry or discard it.
  const recoveryWindow =
    typeof window === "undefined"
      ? undefined
      : (window as Window & {
          __hitslopDocumentRecovery?: (action: string) => Promise<unknown>;
        });
  const recovery = async (action: string) => {
    if (action === "render") {
      const reset = scope.resetRender;
      scope.resetRender = undefined;
      scope.renderError = undefined;
      reset?.();
      await tick();
      if (scope.renderError) return { ok: false, error: { message: scope.renderError } };
      return { ok: true };
    }
    if (action === "retry") {
      const result = await controller.retryUnknown();
      if (!result.ok) return result;
      controller.clearError();
      for (const draft of drafts.retained) {
        const result = await drafts.retry(draft.id);
        if (result && !result.ok) return result;
      }
      return controller.flush();
    }
    if (action === "discard") {
      if (controller.hasUnknownOutcome)
        return {
          ok: false,
          error: { message: "Resolve the outstanding request before discarding drafts" },
        };
      for (const draft of drafts.retained) {
        const result = drafts.discard(draft.id);
        if (!result.ok) return result;
      }
      controller.clearError();
    }
    return { error: controller.error, drafts: drafts.retained };
  };
  if (recoveryWindow) recoveryWindow.__hitslopDocumentRecovery = recovery;
  const unregister = registerFlush("document", flush);
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (recoveryWindow?.__hitslopDocumentRecovery === recovery)
      delete recoveryWindow.__hitslopDocumentRecovery;
    unregister();
    unstore();
    unerror();
    undrafts();
    unwriter();
    drafts.dispose();
    controller.dispose();
  }
  let destruction: Promise<void> | undefined;
  function destroy() {
    if (disposed) return Promise.resolve();
    return (destruction ??= (async () => {
      try {
        await flush();
        dispose();
      } catch (error) {
        destruction = undefined;
        throw error;
      }
    })());
  }
  onDestroy(() => {
    void destroy().catch((error) => {
      // A failed initial open has no edits to retain after the component is gone.
      if (controller.revision < 0) {
        dispose();
        return;
      }
      console.error("hitSlop document teardown failed", error);
    });
  });
  void controller.ready.then(async () => {
    await tick();
    if (!disposed) ready();
  });
  function mutation<A extends unknown[], R extends MutationResult>(
    action: (...args: A) => Promise<R>,
  ) {
    // Dispatch synchronously so using document verbs inside a transaction still throws.
    return (...args: A): Promise<R> =>
      action(...args).then((result) => {
        if (!result.ok) return result;
        return {
          ...result,
          get canUndo() {
            void status.revision;
            return result.canUndo;
          },
          ...(result.undo ? { undo: result.undo } : {}),
        } as R;
      });
  }
  const store: SlopDocument<S> = {
    fields: paths(options.schema),
    isPending(path) {
      void status.pending;
      return controller.isPending(path);
    },
    set: mutation(controller.set),
    unset: mutation(controller.unset),
    toggle: mutation(controller.toggle),
    increment: mutation(controller.increment),
    insert: mutation(controller.insert),
    remove: mutation(controller.remove),
    move: mutation(controller.move),
    patch: mutation(controller.patch),
    transaction: mutation(controller.transaction),
    get data() {
      return data;
    },
    get revision() {
      return status.revision;
    },
    get authority() {
      return status.authority;
    },
    get isLoading() {
      return status.isLoading;
    },
    get pending() {
      return status.pending;
    },
    get error() {
      return status.error;
    },
    get connected() {
      return status.connected;
    },
    get canWrite() {
      return status.canWrite;
    },
    get hasUnknownOutcome() {
      return status.hasUnknownOutcome;
    },
    text(path) {
      if (path[pathInfo].root !== options.schema) throw new Error("Path belongs to another schema");
      return attachText(path);
    },
    flush,
    destroy,
  };
  const scope = documentScope(store);
  // Undo and close/export share the same barrier, including pending media imports.
  const unwriter = controller.registerDraft(async () => {
    try {
      await flushDocumentWriters(store);
      return { ok: true, revision: controller.revision };
    } catch (cause) {
      const error = { code: "storage_unavailable" as const, message: String(cause) };
      scope.report({ source: "document", ...error });
      return { ok: false, error };
    }
  });
  const unerror = controller.onError((error) => scope.report({ source: "document", ...error }));
  return store;
}
