import { createDocumentRuntimeLoader } from "./document-runtime.js";

declare global { interface Window { __hitslopPreviewRuntime?: ReturnType<typeof createDocumentRuntimeLoader> } }
window.__hitslopPreviewRuntime = createDocumentRuntimeLoader(window.__hitslopRuntimeConfig!);
