import * as Type from "typebox";

const somaAmpSchema = Type.Object({
  selectedStationId: Type.String(),
  skinName: Type.Union([Type.String(), Type.Null()]),
  milkdropOpen: Type.Boolean(),
}, { additionalProperties: true });

export type SomaAmp = Type.Static<typeof somaAmpSchema>;
export default somaAmpSchema;
