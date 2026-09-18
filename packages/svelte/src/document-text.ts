import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { TSchema } from "typebox";
import { pathInfo, read, type Address } from "@hitslop/schema/document";
import {
  canonical,
  failure,
  CommandError,
  type Request,
  type Result,
} from "@hitslop/schema/document-protocol";

type Owner = {
  readonly data: unknown;
  readonly revision: number;
  readonly hasUnknownOutcome: boolean;
  set(path: Address, value: any): Promise<Result>;
  subscribe(listener: () => void): () => void;
  registerDraft(flush: () => Promise<Result>): () => void;
  onResolution(listener: (request: Request, result: Result) => void): () => void;
};

/** Drafts outlive DOM nodes when a remote deletion removes an edited row. */
export class TextDrafts {
  private drafts = new Map<string, Draft>();
  private listeners = new Set<() => void>();
  constructor(
    private owner: Owner,
    readonly debounceMs = 300,
  ) {}
  notify = () => {
    for (const listener of this.listeners) listener();
  };
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  get retained() {
    return [...this.drafts.values()]
      .filter((d) => d.failed || (!d.attached && d.dirty))
      .map((d) => ({ id: d.id, value: d.value, path: d.label, failed: d.failed }));
  }
  create(path: Address): Draft {
    const id = canonical(path[pathInfo].steps);
    const previous = this.drafts.get(id);
    if (previous) return previous;
    const draft = new Draft(this.owner, path, this, () => this.drafts.delete(id));
    this.drafts.set(id, draft);
    return draft;
  }
  retry(id: string) {
    return this.drafts.get(id)?.commit(true);
  }
  discard(id: string) {
    return this.drafts.get(id)?.discard() ?? { ok: true as const, revision: this.owner.revision };
  }
  dispose() {
    for (const draft of this.drafts.values()) draft.dispose();
    this.drafts.clear();
    this.listeners.clear();
  }
}

export class Draft {
  readonly id: string;
  readonly label: string;
  value: string;
  dirty = false;
  failed = false;
  private attachments = new Set<{ focused: boolean; composing: boolean }>();
  get attached() {
    return this.attachments.size > 0;
  }
  get focused() {
    return [...this.attachments].some((binding) => binding.focused);
  }
  get composing() {
    return [...this.attachments].some((binding) => binding.composing);
  }
  private version = 0;
  private pending: Promise<Result> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private unregister: () => void;
  private unresolve: () => void;
  private uncertain: { version: number; value: string } | undefined;
  private disposed = false;
  constructor(
    private owner: Owner,
    private path: Address,
    private manager: TextDrafts,
    private remove: () => void,
  ) {
    this.id = canonical(path[pathInfo].steps);
    this.label = path[pathInfo].steps.map((s) => ("key" in s ? s.key : `[${s.item}]`)).join(" / ");
    this.value = this.confirmed() ?? "";
    this.unsubscribe = owner.subscribe(() => {
      if (!this.dirty && !this.pending && !this.composing && !this.focused) {
        const value = this.confirmed();
        if (value !== undefined && value !== this.value) {
          this.value = value;
          this.notify();
        }
      }
    });
    this.unregister = owner.registerDraft(() => this.commit(true));
    this.unresolve = owner.onResolution((request, result) => {
      if (!this.uncertain || !("ops" in request) || request.ops.length !== 1) return;
      const op = request.ops[0]!;
      if (op.op !== "set" || canonical(op.path) !== this.id || op.value !== this.uncertain.value)
        return;
      if (result.ok && this.version === this.uncertain.version) {
        this.dirty = false;
        this.failed = false;
      }
      this.uncertain = undefined;
      this.notify();
      if (!this.attached && !this.dirty) this.dispose();
    });
  }
  private confirmed() {
    const value = read(this.owner.data, this.path);
    return typeof value === "string" ? value : undefined;
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private notify() {
    for (const listener of this.listeners) listener();
    this.manager.notify();
  }
  edit(value: string) {
    this.value = value;
    this.version++;
    this.dirty = true;
    this.failed = false;
    clearTimeout(this.timer);
    if (!this.composing)
      this.timer = setTimeout(() => {
        void this.commit();
      }, this.manager.debounceMs);
    this.notify();
  }
  async commit(force = false): Promise<Result> {
    clearTimeout(this.timer);
    if (this.pending) {
      const result = await this.pending;
      if (!result.ok) return result;
    }
    if (this.composing && !force) return { ok: true, revision: this.owner.revision };
    if (force) for (const binding of this.attachments) binding.composing = false;
    if (!this.dirty) return { ok: true, revision: this.owner.revision };
    const value = this.value,
      version = this.version;
    const task = this.owner.set(this.path, value);
    this.pending = task;
    const result = await task;
    this.pending = undefined;
    if (!result.ok && result.error.code === "unknown_outcome")
      this.uncertain ??= { value, version };
    if (result.ok && version === this.version) {
      this.dirty = false;
      this.failed = false;
    } else if (!result.ok) this.failed = true;
    this.notify();
    if (!this.attached && !this.dirty) this.dispose();
    if (force && result.ok && this.dirty) return this.commit(true);
    return result;
  }
  attach() {
    const binding = { focused: false, composing: false };
    this.attachments.add(binding);
    return binding;
  }
  blur(binding: { focused: boolean; composing: boolean }) {
    binding.focused = false;
    binding.composing = false;
    if (this.dirty) void this.commit(!this.composing);
    else if (!this.focused && !this.composing) {
      this.value = this.confirmed() ?? this.value;
      this.notify();
    }
  }
  detach(binding: { focused: boolean; composing: boolean }) {
    this.attachments.delete(binding);
    if (this.attached) return;
    clearTimeout(this.timer);
    if (this.dirty) {
      void this.commit(true);
      this.notify();
    } else if (!this.pending) this.dispose();
  }
  discard() {
    if (this.uncertain || this.owner.hasUnknownOutcome)
      return failure(
        new CommandError(
          "unknown_outcome",
          "Resolve the outstanding request before discarding this draft",
        ),
      );
    if (this.pending)
      return failure(
        new CommandError("invalid_operation", "Wait for the pending draft before discarding it"),
      );
    clearTimeout(this.timer);
    this.value = this.confirmed() ?? "";
    this.dirty = false;
    this.failed = false;
    this.notify();
    if (!this.attached) this.dispose();
    return { ok: true as const, revision: this.owner.revision };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer);
    this.unsubscribe();
    this.unregister();
    this.unresolve();
    this.listeners.clear();
    this.remove();
  }
}

/** A stable address owns the attachment; snapshot reads never remount it. */
export function textAttachment(manager: TextDrafts) {
  const cache = new Map<string, Attachment<HTMLTextAreaElement | HTMLInputElement>>();
  return (path: Address<TSchema>): Attachment<HTMLTextAreaElement | HTMLInputElement> => {
    const id = canonical(path[pathInfo].steps);
    const cached = cache.get(id);
    if (cached) return cached;
    const attachment: Attachment<HTMLTextAreaElement | HTMLInputElement> = (node) =>
      untrack(() => {
        const draft = manager.create(path),
          binding = draft.attach();
        const paint = () => {
          if (node.value !== draft.value) node.value = draft.value;
          node.setAttribute("aria-invalid", String(draft.failed));
        };
        paint();
        const unsubscribe = draft.subscribe(paint);
        const input = () => draft.edit(node.value);
        const focus = () => {
          binding.focused = true;
        };
        const blur = () => draft.blur(binding);
        const compositionStart = () => {
          binding.composing = true;
        };
        const compositionEnd = () => {
          binding.composing = false;
          input();
        };
        node.addEventListener("input", input);
        node.addEventListener("focus", focus);
        node.addEventListener("blur", blur);
        node.addEventListener("compositionstart", compositionStart);
        node.addEventListener("compositionend", compositionEnd);
        return () => {
          unsubscribe();
          draft.detach(binding);
          node.removeEventListener("input", input);
          node.removeEventListener("focus", focus);
          node.removeEventListener("blur", blur);
          node.removeEventListener("compositionstart", compositionStart);
          node.removeEventListener("compositionend", compositionEnd);
          // Keep mounted duplicate bindings stable, release unused row addresses.
          if (!draft.attached) cache.delete(id);
        };
      });
    cache.set(id, attachment);
    return attachment;
  };
}
