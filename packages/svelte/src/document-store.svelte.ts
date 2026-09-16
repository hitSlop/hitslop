import {
  createDocumentController,
  type DraftContext,
  type ReadonlyJSON,
} from "@hitslop/runtime/adapter";
import type { DocumentFrame } from "@hitslop/runtime";
import type { TSchema, Static } from "typebox";

type Owner = {
  readonly frame: DocumentFrame | undefined;
  readonly recovery: number;
  begin(frame: DocumentFrame | undefined): DraftContext;
  end(context: DraftContext): void;
  submit(mutate: (value: any) => void, context?: DraftContext): Promise<void>;
  registerDraft(flush: () => void): () => void;
};
const owners = new WeakMap<object, Owner>();
export type DocumentStoreOptions<S extends TSchema> = { schema: S; initial: NoInfer<Static<S>> };

export function documentStore<S extends TSchema>(options: DocumentStoreOptions<S>) {
  const controller = createDocumentController(options);
  let version = $state(0);
  const unsubscribe = controller.subscribe(() => {
    version++;
  });
  const store = {
    get current() {
      version;
      return controller.current;
    },
    get isReady() {
      version;
      return controller.isReady;
    },
    get isLoading() {
      version;
      return controller.isLoading;
    },
    get isDirty() {
      version;
      return controller.isDirty;
    },
    get hasFailedChanges() {
      version;
      return controller.hasFailedChanges;
    },
    get error() {
      version;
      return controller.error;
    },
    change: controller.change,
    flush: controller.flush,
    reload: controller.reload,
    discardFailedChanges: controller.discardFailedChanges,
    async destroy() {
      await controller.destroy();
      unsubscribe();
    },
  };
  owners.set(store, {
    get frame() {
      version;
      return controller.frame;
    },
    get recovery() {
      version;
      return controller.recovery;
    },
    begin: controller.begin,
    end: controller.end,
    submit: controller.submit,
    registerDraft: controller.registerDraft,
  });
  return store;
}
export type DocumentStore<S extends TSchema> = ReturnType<typeof documentStore<S>>;

/** Local text drafts. Confirmed document state still comes from the host. */
export function documentText<T>(
  node: HTMLTextAreaElement | HTMLInputElement,
  options: {
    store: {
      readonly current: ReadonlyJSON<NoInfer<T>>;
      change(mutator: (value: T) => void): Promise<void>;
    };
    read(data: ReadonlyJSON<NoInfer<T>>): string;
    write(data: T, value: string): void;
  },
) {
  let config = $state.raw(options);
  const owner = owners.get(options.store);
  if (!owner) throw new Error("documentText requires documentStore");
  let pending = 0,
    composing = false,
    submitted = options.read(options.store.current),
    disposed = false;
  let displayed = owner.frame,
    context: DraftContext | undefined;
  let recovery = owner.recovery;
  node.value = submitted;
  const reconcile = () => {
    if (recovery !== owner.recovery) {
      recovery = owner.recovery;
      if (context) owner.end(context);
      context = undefined;
    }
    if (disposed || pending || composing || context?.failed) return;
    if (context) {
      owner.end(context);
      context = undefined;
    }
    displayed = owner.frame;
    const next = config.read(config.store.current);
    if (next === node.value) return;
    const previous = node.value;
    let prefix = 0;
    while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix])
      prefix++;
    let suffix = 0;
    while (
      suffix < previous.length - prefix &&
      suffix < next.length - prefix &&
      previous.at(-suffix - 1) === next.at(-suffix - 1)
    )
      suffix++;
    const adjust = (position: number) =>
      position <= prefix
        ? position
        : position >= previous.length - suffix
          ? position + next.length - previous.length
          : next.length - suffix;
    const start = adjust(node.selectionStart ?? 0),
      end = adjust(node.selectionEnd ?? 0),
      direction = node.selectionDirection ?? "none";
    node.value = next;
    submitted = next;
    if (document.activeElement === node && node.selectionStart !== null)
      node.setSelectionRange(start, end, direction);
  };
  const input = () => {
    if (composing || node.value === submitted) return;
    if (!displayed) return;
    context ??= owner.begin(displayed);
    const value = node.value;
    submitted = value;
    pending++;
    const write = config.write;
    void owner
      .submit((data) => write(data, value), context)
      .catch(() => undefined)
      .finally(() => {
        pending--;
        if (disposed) {
          if (context && !pending) owner.end(context);
        } else reconcile();
      });
  };
  const compositionStart = () => {
    if (displayed) context ??= owner.begin(displayed);
    composing = true;
  };
  const compositionEnd = () => {
    composing = false;
    input();
    reconcile();
  };
  $effect(() => {
    owner.recovery;
    owner.frame;
    config.read(config.store.current);
    reconcile();
  });
  const unregisterDraft = owner.registerDraft(() => {
    if (composing) composing = false;
    input();
  });
  node.addEventListener("input", input);
  node.addEventListener("compositionstart", compositionStart);
  node.addEventListener("compositionend", compositionEnd);
  return {
    update(next: typeof options) {
      if (next.store !== options.store) throw new Error("Text store cannot change");
      config = next;
    },
    destroy() {
      if (composing) composing = false;
      input();
      disposed = true;
      unregisterDraft();
      if (context && !pending) owner.end(context);
      node.removeEventListener("input", input);
      node.removeEventListener("compositionstart", compositionStart);
      node.removeEventListener("compositionend", compositionEnd);
    },
  };
}
