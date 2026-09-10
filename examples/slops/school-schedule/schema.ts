import * as Type from "typebox";

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI"] as const;
export type DayKey = (typeof DAYS)[number];

export const COLORS = ["sage", "slate", "amber", "terracotta", "indigo", "rose", "teal"] as const;
export type SubjectColor = (typeof COLORS)[number];

const day = Type.Enum(["MON", "TUE", "WED", "THU", "FRI"]);
const color = Type.Enum(["sage", "slate", "amber", "terracotta", "indigo", "rose", "teal"]);

const period = Type.Object({
  id: Type.String(),
  name: Type.String(),
  start: Type.String(),
  end: Type.String(),
}, { additionalProperties: true });

const classEntry = Type.Object({
  id: Type.String(),
  periodId: Type.String(),
  day,
  subject: Type.String(),
  room: Type.String(),
  teacher: Type.String(),
  color,
}, { additionalProperties: true });

const activity = Type.Object({
  id: Type.String(),
  day,
  start: Type.String(),
  end: Type.String(),
  title: Type.String(),
  location: Type.String(),
}, { additionalProperties: true });

const scheduleSchema = Type.Object({
  studentName: Type.String(),
  term: Type.String(),
  homeroom: Type.String(),
  locker: Type.String(),
  periods: Type.Array(period),
  classes: Type.Array(classEntry),
  activities: Type.Array(activity),
}, { additionalProperties: true });

export type PeriodSlot = Type.Static<typeof period>;
export type ClassEntry = Type.Static<typeof classEntry>;
export type ActivityEntry = Type.Static<typeof activity>;
export type Schedule = Type.Static<typeof scheduleSchema>;
export default scheduleSchema;

export function isDay(value: string): value is DayKey {
  return (DAYS as readonly string[]).includes(value);
}

export function isColor(value: string): value is SubjectColor {
  return (COLORS as readonly string[]).includes(value);
}

export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function formatClock(hhmm: string): string {
  if (!hhmm) return "";
  const [hours, minutes] = hhmm.split(":");
  if (!hours) return hhmm;
  return `${hours.padStart(2, "0")}:${(minutes || "00").padStart(2, "0")}`;
}

export function addMinutes(hhmm: string, delta: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 59, toMinutes(hhmm) + delta));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isBreakName(name: string): boolean {
  const label = name.toLowerCase();
  return label.includes("lunch") || label.includes("advisory") || label.includes("break") || label.includes("recess");
}
