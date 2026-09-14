import * as Type from "typebox";

const radioSchema = Type.Object({
  selectedChannelId: Type.String(),
  favoriteChannelIds: Type.Array(Type.String()),
  volume: Type.Number(),
  muted: Type.Boolean(),
}, { additionalProperties: true });

export type AlienRadio = Type.Static<typeof radioSchema>;
export default radioSchema;
