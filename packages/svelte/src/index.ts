export { default as Slop } from "./Slop.svelte";
export { useSlop } from "./slop-context.js";
export type { InsertResult, MutationResult } from "@hitslop/runtime";
export {
  createDocument,
  type SlopDocument,
  type CreateDocumentOptions,
} from "./create-document.svelte.js";
export { imageStore, type ImageStore, type ImageStoreOptions } from "./image-store.svelte.js";
export { fileStore, type FileStore, type FileStoreOptions } from "./file-store.svelte.js";
export { default as IconTarget } from "./IconTarget.svelte";
export { default as ExportTarget } from "./ExportTarget.svelte";
