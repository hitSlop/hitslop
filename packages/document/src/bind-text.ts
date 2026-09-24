import { observe, type TextHandle } from "./handles";

type Splice = { index: number; delete: number; insert: string };
/** The single edit that turns `from` into `to` (common prefix and suffix removed). */
export function diff(from: string, to: string): Splice {
  let start = 0;
  const limit = Math.min(from.length, to.length);
  while (start < limit && from.charCodeAt(start) === to.charCodeAt(start)) start++;
  // DOM offsets are UTF-16, but Loro cannot splice inside a surrogate pair.
  if (splitsCodePoint(from, start) || splitsCodePoint(to, start)) start--;
  let end = 0;
  while (
    end < limit - start &&
    from.charCodeAt(from.length - 1 - end) === to.charCodeAt(to.length - 1 - end)
  )
    end++;
  if (splitsCodePoint(from, from.length - end) || splitsCodePoint(to, to.length - end)) end--;
  return { index: start, delete: from.length - start - end, insert: to.slice(start, to.length - end) };
}
function splitsCodePoint(value: string, offset: number): boolean {
  const before = value.charCodeAt(offset - 1);
  const after = value.charCodeAt(offset);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}
/** Move an offset in `before` coordinates past an edit. */
function shift(offset: number, edit: Splice, after = false) {
  if (offset === edit.index && after && edit.delete === 0) return offset + edit.insert.length;
  if (offset <= edit.index) return offset;
  if (offset >= edit.index + edit.delete) return offset + edit.insert.length - edit.delete;
  return edit.index + edit.insert.length;
}

/**
 * Native plain-text input integration. Local typing becomes text splices, so an
 * edit made against a stale value (during IME composition, or before a remote
 * edit was rendered) is transformed past the remote change instead of erasing it.
 */
export function bindText(element: HTMLInputElement | HTMLTextAreaElement, initial: TextHandle) {
  let handle = initial;
  let observer = observe(handle);
  let composing = false;
  let stop: () => void;
  let stopDraft: (() => void) | undefined;
  let unavailable = false;
  let previousDisabled = element.disabled;
  /** The document value the element last reflected. */
  let base = "";
  const read = () => {
    const value = observer.source.read(observer.path);
    return typeof value === "string" ? value : undefined;
  };
  const render = (value: string) => {
    const focused = typeof document !== "undefined" && document.activeElement === element;
    const edit = diff(element.value, value);
    const start = element.selectionStart;
    const end = element.selectionEnd;
    element.value = value;
    if (focused && start !== null && end !== null && edit.delete + edit.insert.length)
      element.setSelectionRange(shift(start, edit), shift(end, edit));
  };
  const sync = () => {
    const value = read();
    if (value === undefined) {
      if (!unavailable) previousDisabled = element.disabled;
      unavailable = true;
      element.disabled = true;
      return;
    }
    if (unavailable) {
      element.disabled = previousDisabled;
      unavailable = false;
    }
    // Leave the DOM's active composition draft alone until compositionend.
    if (composing) return;
    if (element.value !== value) render(value);
    base = value;
  };
  const write = () => {
    const current = read();
    if (current === undefined || element.value === base) return;
    const local = diff(base, element.value);
    let edit = local;
    if (current !== base) {
      // Transform the local edit past the remote edit made since `base`.
      const remote = diff(base, current);
      const from = shift(local.index, remote, true);
      const to = shift(local.index + local.delete, remote);
      edit = { index: from, delete: Math.max(0, to - from), insert: local.insert };
    }
    if (edit.delete || edit.insert) handle.splice(edit.index, edit.delete, edit.insert);
    const merged = read() ?? element.value;
    if (merged !== element.value) render(merged);
    base = merged;
  };
  const input = (event: Event) => {
    if (!composing && !(event as InputEvent).isComposing) write();
  };
  const start = () => {
    composing = true;
  };
  const end = () => {
    composing = false;
    write();
  };
  const draft = () => {
    if (!unavailable) {
      composing = false;
      write();
    }
  };
  element.addEventListener("input", input);
  element.addEventListener("compositionstart", start);
  element.addEventListener("compositionend", end);
  stop = observer.source.subscribe(sync);
  stopDraft = observer.source.beforeFlush?.(draft);
  sync();
  return {
    update(next: TextHandle) {
      // Svelte may supply a fresh handle for the same identity on each render.
      const nextObserver = observe(next);
      if (
        nextObserver.source === observer.source &&
        JSON.stringify(nextObserver.path) === JSON.stringify(observer.path)
      ) {
        handle = next;
        return;
      }
      stop();
      stopDraft?.();
      composing = false;
      handle = next;
      observer = nextObserver;
      stop = observer.source.subscribe(sync);
      stopDraft = observer.source.beforeFlush?.(draft);
      base = element.value;
      sync();
    },
    destroy() {
      stop();
      stopDraft?.();
      element.removeEventListener("input", input);
      element.removeEventListener("compositionstart", start);
      element.removeEventListener("compositionend", end);
      if (unavailable) element.disabled = previousDisabled;
    },
  };
}
