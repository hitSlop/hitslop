import { observe, type ScalarHandle } from "./handles";
import { unwrap, type Scalar } from "./schema";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
/**
 * Bind a checkbox, range, number, text-like input or select to a scalar field.
 * While a range is dragged, `input` events only preview the value; `change`
 * commits one edit, so a drag leaves one history entry instead of hundreds.
 */
export function bindValue(element: Control, initial: ScalarHandle<any>) {
  let handle = initial;
  let observer = observe(handle);
  let dragging = false;
  let previewed = false;
  let stop: () => void;
  let stopDraft: (() => void) | undefined;
  const scalar = () => unwrap(observer.node) as Scalar;
  const checkbox = () => (element as HTMLInputElement).type === "checkbox";
  const parse = (): unknown => {
    if (checkbox()) return (element as HTMLInputElement).checked;
    const kind = scalar().kind;
    if (kind === "number" || kind === "integer") {
      const value = Number(element.value);
      return element.value === "" || !Number.isFinite(value) ? undefined : value;
    }
    if (kind === "boolean") return element.value === "true";
    return element.value;
  };
  const sync = () => {
    const value = observer.source.read(observer.path);
    element.disabled = value === undefined && observer.node.kind !== "optional";
    if (dragging || value === undefined) return;
    if (checkbox()) (element as HTMLInputElement).checked = value === true;
    else if (element.value !== String(value)) element.value = String(value);
  };
  const commit = () => {
    dragging = false;
    const value = parse();
    if (value === undefined || (!previewed && value === observer.source.read(observer.path))) return sync();
    try {
      handle.set(value);
      previewed = false;
    } catch (error) {
      sync();
      throw error;
    }
  };
  const input = () => {
    if (checkbox() || element.tagName === "SELECT") return;
    const value = parse();
    if (value === undefined) return;
    if (value === observer.source.read(observer.path)) return;
    dragging = true;
    try {
      handle.preview(value);
      previewed = true;
    } catch {
      // Out-of-range input stays local until the user commits or reverts it.
    }
  };
  const listen = () => {
    element.addEventListener("input", input);
    element.addEventListener("change", commit);
    stop = observer.source.subscribe(sync);
    stopDraft = observer.source.beforeFlush?.(() => {
      if (dragging) commit();
    });
    sync();
  };
  const unlisten = () => {
    stop();
    stopDraft?.();
    element.removeEventListener("input", input);
    element.removeEventListener("change", commit);
  };
  listen();
  return {
    update(next: ScalarHandle<any>) {
      const nextObserver = observe(next);
      handle = next;
      if (
        nextObserver.source === observer.source &&
        JSON.stringify(nextObserver.path) === JSON.stringify(observer.path)
      )
        return;
      unlisten();
      dragging = false;
      previewed = false;
      observer = nextObserver;
      listen();
    },
    destroy: unlisten,
  };
}
