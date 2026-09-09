import { MediaStore } from "./media-store.svelte.js";
export type ImageStoreOptions = { fallback: string };
export class ImageStore extends MediaStore<string> {
  constructor(name: string, readonly options: ImageStoreOptions) { super(name, options.fallback, "image/*"); }
  get hasCustomImage(): boolean { return this.hasCustomMedia; }
}
export const imageStore = (name: string, options: ImageStoreOptions): ImageStore => new ImageStore(name, options);
