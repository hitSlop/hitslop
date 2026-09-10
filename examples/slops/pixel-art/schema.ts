import * as Type from "typebox";

const pixelArtSchema = Type.Object({
  pixels: Type.Array(Type.String()),
  paletteId: Type.String(),
  selectedColor: Type.String(),
}, { additionalProperties: true });

export type PixelArt = Type.Static<typeof pixelArtSchema>;
export default pixelArtSchema;
