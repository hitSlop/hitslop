import * as Type from "typebox";

const contactSchema = Type.Object({
  name: Type.String(),
  headline: Type.String(),
  location: Type.String(),
  bio: Type.String(),
  email: Type.String(),
  phone: Type.String(),
  website: Type.String(),
}, { additionalProperties: true });

export type ContactCard = Type.Static<typeof contactSchema>;
export default contactSchema;
