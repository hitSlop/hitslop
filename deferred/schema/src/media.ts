import * as Type from "typebox";
export const MediaHashSchema = Type.String({ pattern: "^[a-f0-9]{64}$" });
export const MediaReferenceSchema = Type.Object(
  {
    sha256: MediaHashSchema,
    mime: Type.String({ minLength: 1, maxLength: 127 }),
    bytes: Type.Integer({ minimum: 1, maximum: 25 * 1024 * 1024 }),
    filename: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  },
  { additionalProperties: false },
);
export type MediaReference = Type.Static<typeof MediaReferenceSchema>;
