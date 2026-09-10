import * as Type from "typebox";

const course = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  colorHex: Type.String(),
}, { additionalProperties: true });

const assignment = Type.Object({
  id: Type.String(),
  courseCode: Type.String(),
  title: Type.String(),
  dueDate: Type.String(),
  category: Type.String(),
  points: Type.Number(),
  completed: Type.Boolean(),
  notes: Type.String(),
}, { additionalProperties: true });

const assignmentTrackerSchema = Type.Object({
  studentName: Type.String(),
  term: Type.String(),
  courses: Type.Array(course),
  assignments: Type.Array(assignment),
}, { additionalProperties: true });

export type Course = Type.Static<typeof course>;
export type Assignment = Type.Static<typeof assignment>;
export type AssignmentTracker = Type.Static<typeof assignmentTrackerSchema>;
export default assignmentTrackerSchema;
