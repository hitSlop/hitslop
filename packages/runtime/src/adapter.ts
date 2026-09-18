/**
 * Building blocks for framework adapters. Ordinary slop applications should
 * use their framework adapter and `@hitslop/runtime` instead.
 */
export {
  createDocumentController,
  type Controller,
  type Mutations,
  type InsertResult,
  type MutationResult,
  type CommandHost,
} from "./document-controller.js";
export { registerFlush } from "./lifecycle.js";
export { LatestTask } from "./latest-task.js";
export { chooseLocalFile, fileToBase64 } from "./media-picker.js";

export type { ReadonlyJSON } from "@hitslop/schema/document";
