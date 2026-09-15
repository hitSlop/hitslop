import type { Static, TSchema } from "typebox";
import type { SyncCommit, SyncSnapshot, SyncStatus } from "./sync.js";

/** Independent of app, bridge, npm and Loro versions. Bump only the SDK floor when required. */
export const minimumRuntimeVersion = "1.0.0";
export const runtimeVersionPattern = "^[1-9][0-9]{0,8}\\.(?:0|[1-9][0-9]{0,8})\\.(?:0|[1-9][0-9]{0,8})(?![\\s\\S])";
export function runtimeVersionParts(version: string): [number, number, number] {
  if (!new RegExp(runtimeVersionPattern).test(version)) throw new Error(`Invalid runtime version: ${version}`);
  return version.split(".").map(Number) as [number, number, number];
}
export function compareRuntimeVersions(a: string, b: string): number {
  const left = runtimeVersionParts(a), right = runtimeVersionParts(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i]! - right[i]!;
  return 0;
}
export function selectRuntime(required: string, available: readonly string[]): string | undefined {
  const [major] = runtimeVersionParts(required);
  return available.filter(version => runtimeVersionParts(version)[0] === major && compareRuntimeVersions(version, required) >= 0)
    .sort(compareRuntimeVersions).at(-1);
}
export function combineRuntimeRequirements(requirements: readonly string[]): string {
  const versions = requirements.length ? [...requirements] : [minimumRuntimeVersion];
  const majors = new Set(versions.map(version => runtimeVersionParts(version)[0]));
  if (majors.size !== 1) throw new Error(`SDK packages require incompatible runtime majors: ${versions.join(", ")}`);
  return versions.sort(compareRuntimeVersions).at(-1)!;
}

export type DocumentValue<S extends TSchema> = Static<S> & Record<string, unknown>;
export interface DocumentIO {
  open(): Promise<SyncSnapshot>;
  commit(value: SyncCommit): Promise<SyncSnapshot>;
  status?(value: SyncStatus): Promise<void>;
}
export type DocumentState = { isReady: boolean; isDirty: boolean; isSaving: boolean; error: string | null; projectionError: string | null };
export type SharedDocument = { documentId: string; schema: string; checkpoint: string };
export type DocumentSeed = { identity: string; checkpoint: string; metadata: string; projection: string };

/** Same-webview interface. Functions never cross the native byte-storage bridge. */
export interface DocumentSession<S extends TSchema> {
  readonly current: DocumentValue<S>;
  readonly state: Readonly<DocumentState>;
  readonly dataVersion: string;
  subscribe(callback: () => void): () => void;
  change(mutate: (draft: DocumentValue<S>) => void): void;
  flush(): Promise<void>;
  externalChanged(): Promise<void>;
  resolveReview(token: string, action: "apply" | "keep" | "cancel"): Promise<boolean>;
  sharingSnapshot(): Promise<SharedDocument & { version: string }>;
  receiveShared(value: SharedDocument): Promise<void>;
  independentCopy(): Promise<DocumentSeed>;
}
export interface DocumentRuntime {
  readonly version: string;
  open<S extends TSchema>(options: { schema: S; initial: DocumentValue<S>; io: DocumentIO }): Promise<DocumentSession<S>>;
  sharedSeed(schema: TSchema, value: SharedDocument): Promise<DocumentSeed>;
}
