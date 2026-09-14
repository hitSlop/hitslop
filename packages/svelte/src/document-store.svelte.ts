import { errors, type WindowSlop } from "@hitslop/runtime";
import { DocumentEngine, canonical, type DocumentIO, type DocumentValue } from "@hitslop/sync/browser";
import { registerFlush } from "@hitslop/runtime/adapter";
import type { TSchema, Static } from "typebox";
import { validateDocument } from "@hitslop/schema/document";

type ReadonlyJSON<T> = T extends (infer U)[] ? readonly ReadonlyJSON<U>[] : T extends object ? { readonly [K in keyof T]: ReadonlyJSON<T[K]> } : T;
const freeze = <T>(value: T): ReadonlyJSON<T> => {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value as ReadonlyJSON<T>;
};
export type DocumentStoreOptions<S extends TSchema> = { schema: S; initial: NoInfer<Static<S>>; io?: DocumentIO };

// The owner outlives hosted views and registers one barrier before opening starts.
class EngineOwner<S extends TSchema> {
  readonly schemaKey: string;
  engine?: DocumentEngine<S>;
  loading = true;
  view?: ReadonlyJSON<Static<S>>;
  private viewVersion?: string;
  private opening!: Promise<DocumentEngine<S>>;
  private listeners = new Set<() => void>();
  private unregister: () => void;
  private unsubscribe?: () => void;
  private disposed = false;
  private readonly io: DocumentIO;

  constructor(private readonly options: DocumentStoreOptions<S>, private readonly bridge?: WindowSlop["sync"]) {
    this.schemaKey = canonical(options.schema);
    this.io = options.io ?? {
      open: () => bridge!.open(), commit: value => bridge!.commit(value),
      status: async value => {
        if (!value.message) { errors.clear("document"); return; }
        errors.report({ id: "document", message: value.persistenceError ? "Changes could not be saved" : "JSON file needs review", details: value.message, dismissible: false,
          action: { label: value.persistenceError ? "Retry saving" : "Review file changes", run: async () => {
            if (value.persistenceError) { await this.flush(); return; }
            const engine = await this.opening;
            const action = await bridge!.review({ proposal: value.proposal, canApply: value.canApply });
            if (action !== "cancel" && !await engine.resolveReview(value.token, action)) throw new Error("The file or document changed. Review the current changes.");
            // Refresh on cancel so the action runner cannot clear unresolved review.
            if (action === "cancel") await this.io.status!(value);
          } },
        });
      },
    };
    this.unregister = registerFlush(() => this.flush());
    this.start();
    bridge?.onChange(event => {
      if (event.source !== "app") void this.opening.then(engine => engine.externalChanged()).catch(() => undefined);
    });
  }
  private start(): Promise<DocumentEngine<S>> {
    this.loading = true;
    this.notify();
    this.opening = Promise.resolve().then(() => DocumentEngine.open({
      schema: this.options.schema,
      initial: (this.bridge && window.slop?.preview && Object.hasOwn(window.slop.preview, "data") ? window.slop.preview.data : this.options.initial) as DocumentValue<S>,
      io: this.io,
    })).then(engine => {
      this.engine = engine;
      this.unsubscribe = engine.subscribe(() => this.notify());
      if (this.bridge) errors.clear("document-open");
      return engine;
    }, error => {
      if (this.bridge) errors.report({ id: "document-open", message: "Document could not be opened", details: error instanceof Error ? error.message : String(error), dismissible: false,
        action: { label: "Retry opening", run: async () => { await this.start(); await this.flush(); } },
      });
      throw error;
    }).finally(() => { this.loading = false; this.notify(); });
    void this.opening.catch(() => undefined);
    return this.opening;
  }
  subscribe(callback: () => void): () => void { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
  private notify() {
    if (this.engine && this.viewVersion !== this.engine.dataVersion) {
      this.viewVersion = this.engine.dataVersion;
      this.view = freeze(this.engine.current) as ReadonlyJSON<Static<S>>;
    }
    for (const callback of this.listeners) callback();
  }
  async flush(): Promise<void> {
    const engine = await this.opening;
    await engine.flush();
    if (this.disposed) { this.unsubscribe?.(); this.unregister(); }
  }
  destroyView(): void {
    // Hosted owners live until the webview closes. Custom-I/O owners have one view.
    if (!this.bridge) this.disposed = true;
    void this.flush().catch(() => undefined);
  }
}
const hostedEngines = new WeakMap<object, EngineOwner<TSchema>>();

export class DocumentStore<S extends TSchema> {
  private view = $state.raw<ReadonlyJSON<Static<S>>>();
  get current(): ReadonlyJSON<Static<S>> { return this.view!; }
  isLoading = $state(true);
  isReady = $state(false);
  private readonly owner: EngineOwner<S>;
  private readonly unsubscribe: () => void;
  private destroyed = false;

  constructor(options: DocumentStoreOptions<S>) {
    this.view = freeze(structuredClone(validateDocument(options.schema, options.initial)));
    const bridge = !options.io && typeof window !== "undefined" ? window.slop?.sync : undefined;
    if (!options.io && !bridge) throw new Error("This document requires a host with sync support");
    if (bridge) {
      let owner = hostedEngines.get(bridge);
      if (owner && owner.schemaKey !== canonical(options.schema)) throw new Error("A document runtime cannot open two different data schemas");
      if (!owner) {
        owner = new EngineOwner(options, bridge) as EngineOwner<TSchema>;
        hostedEngines.set(bridge, owner);
      }
      this.owner = owner as EngineOwner<S>;
    } else this.owner = new EngineOwner(options);
    this.unsubscribe = this.owner.subscribe(() => this.adopt());
    this.adopt();
  }
  private adopt() {
    this.isLoading = this.owner.loading;
    this.isReady = this.owner.engine?.state.isReady ?? false;
    if (this.owner.view) this.view = this.owner.view;
  }
  change(mutate: (draft: Static<S>) => void): void {
    if (!this.owner.engine || this.destroyed) throw new Error("Document is not open");
    this.owner.engine.change(mutate);
  }
  flush(): Promise<void> { return this.owner.flush(); }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.owner.destroyView();
  }
}
export const documentStore = <S extends TSchema>(options: DocumentStoreOptions<S>): DocumentStore<S> => new DocumentStore(options);
