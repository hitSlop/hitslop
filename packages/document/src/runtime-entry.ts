export { Document } from "./document";
export { Session } from "./session";
export { HostStore, hostCall } from "./bridge";
export { MemoryStore } from "./memory";
export { observe, observeText } from "./handles";
export { bindText } from "./bind-text";
export { bindValue } from "./bind-value";
export { capture, captureController, createCaptureController } from "./capture";
export const runtimeVersion = "hitslop-v1";
let initializing: Promise<void> | undefined;
export function initialize() {
  return (initializing ??= (async () => {
    const url = new URL("./loro/index.js", import.meta.url).href;
    const { default: init } = await import(url);
    await init({ module_or_path: new URL("./loro/loro_wasm_bg.wasm", import.meta.url).href });
  })());
}
// Begin fetching and compiling WASM while the app bundle is still evaluating.
// Callers observe failures through initialize().
initialize().catch(() => {});

export { installPresentationStage } from "./presentation";
export { fromDescriptor } from "./schema";

export { openTheme } from "./theme-runtime";
export { attachments, configureAttachments } from "./attachments";
export { default as runtimeIdentity } from "./runtime-identity.json";
