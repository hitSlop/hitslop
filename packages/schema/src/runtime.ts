import * as T from "typebox";

const version = T.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
const provenance = {
  sdkVersion: T.String({ minLength: 1, maxLength: 128 }),
  loroVersion: T.String({ minLength: 1, maxLength: 128 }),
  protocolVersion: version,
};
export const RuntimeRequirementsSchema = T.Object({
  runtimeContract: version,
  minRuntimeRevision: version,
  ...provenance,
});
export const RuntimeIdentitySchema = T.Object({
  runtimeContract: version,
  runtimeRevision: version,
  ...provenance,
});
export const RuntimeCapabilitiesSchema = T.Object({
  current: RuntimeIdentitySchema,
  runtimes: T.Array(RuntimeIdentitySchema, { minItems: 1 }),
});
