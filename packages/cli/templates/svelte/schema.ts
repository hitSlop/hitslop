import * as Type from "typebox";

export default Type.Object({
  count: Type.Integer({ description: "Current tally count value" }),
}, { additionalProperties: true });
