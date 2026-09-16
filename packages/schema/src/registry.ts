import * as Type from "typebox";

const id = Type.String({ minLength: 1, maxLength: 160 });

export const RegistryPublishResultSchema = Type.Object(
  {
    templateId: id,
    releaseId: id,
    releaseNumber: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  },
  { additionalProperties: false, title: "RegistryPublishResult" },
);

export type RegistryPublishResult = Type.Static<typeof RegistryPublishResultSchema>;
