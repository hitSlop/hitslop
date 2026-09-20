export { Document } from "./document";
export { Session } from "./session";
export { HostStore, hostCall } from "./bridge";
export { MemoryStore } from "./memory";
export { observeText } from "./handles";
export { bindText } from "./bind-text";
export { capture, captureController, createCaptureController } from "./capture";
export const runtimeVersion = "hitslop-v1";
export async function initialize() {
  const url = new URL("./loro/index.js", import.meta.url).href;
  const { default: init } = await import(url);
  await init({ module_or_path: new URL("./loro/loro_wasm_bg.wasm", import.meta.url).href });
}

export { installPresentationStage } from "./presentation";
export { fromDescriptor } from "./schema";

export { openTheme } from "./theme-runtime";
export { default as runtimeIdentity } from "./runtime-identity.json";
