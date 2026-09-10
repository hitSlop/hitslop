import * as Type from "typebox";

const stopTag = Type.Enum(["flight", "hotel", "dining", "train", "explore"]);

const stop = Type.Object({
  id: Type.String(),
  time: Type.String(),
  title: Type.String(),
  location: Type.String(),
  tag: stopTag,
  done: Type.Boolean(),
}, { additionalProperties: true });

const day = Type.Object({
  id: Type.String(),
  title: Type.String(),
  subtitle: Type.String(),
  date: Type.String(),
  events: Type.Array(stop),
}, { additionalProperties: true });

const stubItem = Type.Object({
  id: Type.String(),
  text: Type.String(),
  done: Type.Boolean(),
}, { additionalProperties: true });

const itinerarySchema = Type.Object({
  tripTitle: Type.String(),
  origin: Type.String(),
  originCity: Type.String(),
  destination: Type.String(),
  destCity: Type.String(),
  bookingRef: Type.String(),
  passenger: Type.String(),
  flight: Type.String(),
  gate: Type.String(),
  seat: Type.String(),
  selectedDayId: Type.String(),
  days: Type.Array(day),
  stubItems: Type.Array(stubItem),
}, { additionalProperties: true });

export type StopTag = Type.Static<typeof stopTag>;
export type TripItinerary = Type.Static<typeof itinerarySchema>;
export default itinerarySchema;
