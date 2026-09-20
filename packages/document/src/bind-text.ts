import { observeText, type TextHandle } from "./handles";

/** Native plain-text input integration. Concurrent composition merging is deferred. */
export function bindText(element: HTMLInputElement | HTMLTextAreaElement, initial: TextHandle) {
  let handle = initial;
  let observer = observeText(handle);
  let composing = false;
  let stop: () => void;
  let stopDraft: (() => void) | undefined;
  let unavailable = false;
  let previousDisabled = element.disabled;
  const sync = () => {
    const value = observer.source.read(observer.path);
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
    if (!composing && element.value !== value) element.value = value;
  };
  const write = () => {
    if (element.value !== observer.source.read(observer.path)) handle.replace(element.value);
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
  element.addEventListener("input", input);
  element.addEventListener("compositionstart", start);
  element.addEventListener("compositionend", end);
  stop = observer.source.subscribe(sync);
  stopDraft = observer.source.beforeFlush?.(() => {
    if (!unavailable) {
      composing = false;
      write();
    }
  });
  sync();
  return {
    update(next: TextHandle) {
      // Svelte may supply a fresh handle for the same identity on each render.
      const nextObserver = observeText(next);
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
      stopDraft = observer.source.beforeFlush?.(() => {
        if (!unavailable) {
          composing = false;
          write();
        }
      });
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
