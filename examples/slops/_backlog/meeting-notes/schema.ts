import * as Type from "typebox";

const agendaItem = Type.Object({
  id: Type.String(),
  text: Type.String(),
  done: Type.Boolean(),
}, { additionalProperties: true });

const decisionItem = Type.Object({
  id: Type.String(),
  text: Type.String(),
}, { additionalProperties: true });

const actionItem = Type.Object({
  id: Type.String(),
  text: Type.String(),
  owner: Type.String(),
  done: Type.Boolean(),
}, { additionalProperties: true });

const meetingSchema = Type.Object({
  title: Type.String(),
  date: Type.String(),
  time: Type.String(),
  attendees: Type.Array(Type.String()),
  agenda: Type.Array(agendaItem),
  decisions: Type.Array(decisionItem),
  notes: Type.String(),
  actions: Type.Array(actionItem),
}, { additionalProperties: true });

export type Meeting = Type.Static<typeof meetingSchema>;
export default meetingSchema;
