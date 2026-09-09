import { MediaStore } from "./media-store.svelte.js";
export type FileStoreOptions = { accept?: string };
export class FileStore extends MediaStore<null> {
  constructor(name: string, readonly options: FileStoreOptions = {}) { super(name, null, options.accept ?? ""); }
  get hasCustomFile(): boolean { return this.hasCustomMedia; }
}
export const fileStore = (name: string, options: FileStoreOptions = {}): FileStore => new FileStore(name, options);
