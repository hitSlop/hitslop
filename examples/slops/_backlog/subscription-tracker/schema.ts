import * as Type from "typebox";

const subscription = Type.Object({
  id: Type.String(),
  name: Type.String(),
  amount: Type.Number(),
  cadence: Type.String(),
  nextRenewal: Type.String(),
  category: Type.String(),
  note: Type.String(),
  active: Type.Boolean(),
}, { additionalProperties: true });

const trackerSchema = Type.Object({
  currency: Type.String(),
  subscriptions: Type.Array(subscription),
}, { additionalProperties: true });

export type Subscription = Type.Static<typeof subscription>;
export type Tracker = Type.Static<typeof trackerSchema>;
export default trackerSchema;
