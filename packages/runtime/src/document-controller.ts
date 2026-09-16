import type { TSchema, Static } from "typebox";
import { DocumentFrameSchema, type DocumentFrame } from "@hitslop/schema/bridge";
import { validateDocument } from "@hitslop/schema/document";
import { validate } from "@hitslop/schema/validation";
import { getHost } from "./index.js";
import { SlopError } from "./errors.js";
import { registerFlush } from "./lifecycle.js";

export type DraftContext = {
  id: string;
  base: string;
  data: unknown;
  parent?: number;
  failed: boolean;
};
export type ReadonlyJSON<T> = T extends object
  ? { readonly [K in keyof T]: ReadonlyJSON<T[K]> }
  : T;
const freeze = <T>(value: T): ReadonlyJSON<T> => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value as ReadonlyJSON<T>;
};

/** Own incoming JSON while reusing already frozen, equal subtrees. */
function reconcile(previous: unknown, next: unknown): unknown {
  if (previous === next) return previous;
  if (!next || typeof next !== "object") return next;
  if (Array.isArray(next)) {
    const old = Array.isArray(previous) ? previous : [];
    const children = next.map((child, index) => reconcile(old[index], child));
    if (
      Array.isArray(previous) &&
      old.length === children.length &&
      children.every((child, index) => child === old[index])
    )
      return previous;
    return Object.freeze(children);
  }
  const old =
    previous && typeof previous === "object" && !Array.isArray(previous)
      ? (previous as Record<string, unknown>)
      : undefined;
  const entries = Object.entries(next).map(
    ([key, child]) =>
      [key, reconcile(old && Object.hasOwn(old, key) ? old[key] : undefined, child)] as const,
  );
  if (
    old &&
    Object.keys(old).length === entries.length &&
    entries.every(([key, child]) => Object.hasOwn(old, key) && old[key] === child)
  )
    return previous;
  return Object.freeze(Object.fromEntries(entries));
}

/** Framework-neutral sequencing, confirmed state and close/recovery barrier. */
export function createDocumentController<S extends TSchema>(options: {
  schema: S;
  initial: NoInfer<Static<S>>;
}) {
  type Value = Static<S>;
  validateDocument(options.schema, options.initial);
  let current = freeze(structuredClone(options.initial));
  let frame: DocumentFrame | undefined;
  let ready = false,
    loading = true,
    closing = false,
    destroyed = false,
    pending = 0,
    sequence = 0,
    recovery = 0;
  let failure: Error | undefined,
    openError: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const drafts = new Set<() => void>();
  const session = crypto.randomUUID();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const host = () => {
    const document = getHost().document;
    if (!document) throw new Error("The hitSlop host does not support document storage");
    return document;
  };
  const adopt = (value: unknown) => {
    const next = validate(DocumentFrameSchema, value);
    if (destroyed || (frame && next.publication < frame.publication)) return;
    if (frame && next.publication === frame.publication && next.revision !== frame.revision) {
      throw new Error("Host changed a document revision without a publication");
    }
    if (!frame || next.revision !== frame.revision) {
      validateDocument(options.schema, next.data);
      current = reconcile(current, next.data) as ReadonlyJSON<Value>;
    }
    if (
      frame &&
      next.publication === frame.publication &&
      next.dirty === frame.dirty &&
      next.error === frame.error &&
      next.projectionError === frame.projectionError
    )
      return;
    // Never retain the mutable transport object, including in draft ancestry.
    frame = { ...next, data: current as DocumentFrame["data"] };
    notify();
  };
  let implicit: DraftContext | undefined;
  let mutating = false;
  let unwatch: (() => void) | undefined;
  const open = async () => {
    loading = true;
    notify();
    try {
      const document = host();
      unwatch ??= document.onChange((value) => {
        try {
          adopt(value);
        } catch (error) {
          openError = String(error);
          notify();
        }
      });
      adopt(await document.open(options.initial));
      ready = true;
      openError = null;
    } catch (error) {
      openError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      loading = false;
      notify();
    }
  };
  let opening = open();
  void opening.catch(() => undefined);
  const failed = () =>
    failure?.message ?? openError ?? frame?.error ?? frame?.projectionError ?? null;
  async function flush() {
    for (const draft of [...drafts]) draft();
    await opening;
    await queue;
    if (failure) throw failure;
    adopt(await host().flush());
    const error = failed();
    if (error) throw new Error(error);
  }
  const unregister = registerFlush(flush);
  function submit(mutator: (draft: Value) => void, context?: DraftContext): Promise<void> {
    if (mutating)
      throw new Error("Nested document changes are not supported; mutate the current draft");
    if (closing) return Promise.reject(new Error("Document view is closed"));
    if (!frame) return opening.then(() => submit(mutator, context));
    // Capture input values while the DOM event is alive. Pending edits share an
    // authored branch, so rapid increments and remote merges keep their ancestry.
    context ??= implicit ??= {
      id: crypto.randomUUID(),
      base: frame.revision,
      data: structuredClone(current),
      failed: false,
    };
    let draft: Value;
    try {
      draft = structuredClone(context.data) as Value;
      mutating = true;
      try {
        mutator(draft);
      } finally {
        mutating = false;
      }
      validateDocument(options.schema, draft);
      context.data = structuredClone(draft);
    } catch (error) {
      context.failed = true;
      failure ??= error instanceof Error ? error : new Error(String(error));
      notify();
      return Promise.reject(error);
    }
    pending++;
    notify();
    const task = queue
      .catch(() => undefined)
      .then(async () => {
        if (failure) throw failure;
        await opening;
        if (context?.failed) throw new Error("This draft needs recovery");
        if (!frame) throw new Error("Document is not ready");
        const next = await host()
          .apply({
            session,
            sequence: ++sequence,
            base: context?.base ?? frame.revision,
            after: draft,
            ...(context
              ? {
                  draft: context.id,
                  ...(context.parent === undefined ? {} : { parent: context.parent }),
                }
              : {}),
          })
          .catch((error) => {
            // Admission limits reject before the host consumes the sequence. Keep
            // recovery usable without silently resubmitting or discarding this edit.
            if (error instanceof SlopError && error.code === "limit_exceeded") sequence--;
            throw error;
          });
        if (context) context.parent = sequence;
        adopt(next);
      });
    queue = task;
    void task
      .catch((error) => {
        if (context) context.failed = true;
        failure ??= error instanceof Error ? error : new Error(String(error));
      })
      .finally(() => {
        pending--;
        if (!pending && implicit) {
          const completed = implicit;
          implicit = undefined;
          void host()
            .releaseDraft({ session, draft: completed.id })
            .catch(() => undefined);
        }
        notify();
      });
    return task;
  }
  return {
    get current() {
      return current;
    },
    get frame() {
      return frame;
    },
    get recovery() {
      return recovery;
    },
    get isReady() {
      return ready;
    },
    get isLoading() {
      return loading;
    },
    get isDirty() {
      return !!frame?.dirty || pending > 0 || !!failure;
    },
    get hasFailedChanges() {
      return !!failure;
    },
    get error() {
      return failed();
    },
    subscribe(callback: () => void) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    registerDraft(flush: () => void) {
      drafts.add(flush);
      return () => {
        drafts.delete(flush);
      };
    },
    change: submit,
    submit,
    flush,
    begin(displayed: DocumentFrame | undefined): DraftContext {
      if (!displayed) throw new Error("Document is not ready");
      return {
        id: crypto.randomUUID(),
        base: displayed.revision,
        data: structuredClone(displayed.data),
        failed: false,
      };
    },
    end(context: DraftContext) {
      void host()
        .releaseDraft({ session, draft: context.id })
        .then(adopt)
        .catch((error) => {
          openError = String(error);
          notify();
        });
    },
    async discardFailedChanges() {
      await queue.catch(() => undefined);
      const next = await host().open();
      failure = undefined;
      implicit = undefined;
      queue = Promise.resolve();
      recovery++;
      adopt(next);
      notify();
    },
    async reload() {
      opening = open();
      await opening;
    },
    async destroy() {
      if (destroyed) return;
      // Capture visible drafts before refusing new edits, then drain accepted work.
      for (const draft of [...drafts]) draft();
      closing = true;
      try {
        await flush();
      } catch (error) {
        closing = false;
        throw error;
      }
      destroyed = true;
      unwatch?.();
      unregister();
      listeners.clear();
      drafts.clear();
    },
  };
}
