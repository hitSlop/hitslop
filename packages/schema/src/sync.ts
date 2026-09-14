import * as Type from "typebox";

const nullable = Type.Union([Type.String(), Type.Null()]);
export const SyncSnapshotSchema = Type.Object({
  identity: nullable, checkpoint: nullable, metadata: nullable, external: nullable,
  generation: Type.String(), externalHash: nullable,
}, { additionalProperties: false });
export const SyncCommitSchema = Type.Object({
  expectedGeneration: Type.String(), expectedExternal: nullable,
  identity: Type.String(), checkpoint: Type.String(), metadata: Type.String(),
  projection: Type.Optional(Type.String()), preserveExternal: Type.Boolean(),
}, { additionalProperties: false });
export const SyncStatusSchema = Type.Object({
  message: Type.String(), token: Type.String(), proposal: Type.String(),
  canApply: Type.Boolean(), needsReview: Type.Boolean(), persistenceError: Type.Boolean(),
}, { additionalProperties: false });
export type SyncSnapshot = Type.Static<typeof SyncSnapshotSchema>;
export type SyncCommit = Type.Static<typeof SyncCommitSchema>;
export type SyncStatus = Type.Static<typeof SyncStatusSchema>;
