import { MediaStore, type MediaDocument, type MediaPath } from "./media-store.svelte.js";
export type ImageStoreOptions = { fallback: string };
export type ImageStore = MediaStore<string>;
export const imageStore = (
  document: MediaDocument,
  path: MediaPath,
  options: ImageStoreOptions,
): ImageStore => new MediaStore(document, path, options.fallback, "image", "image/*");
