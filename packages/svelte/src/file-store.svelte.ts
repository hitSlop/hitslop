import { MediaStore, type MediaDocument, type MediaPath } from "./media-store.svelte.js";
export type FileStoreOptions = { accept?: string };
export type FileStore = MediaStore<null>;
export const fileStore = (
  document: MediaDocument,
  path: MediaPath,
  options: FileStoreOptions = {},
): FileStore => new MediaStore(document, path, null, "file", options.accept ?? "");
