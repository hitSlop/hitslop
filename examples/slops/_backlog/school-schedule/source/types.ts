export type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI";

export type SubjectColor = "sage" | "slate" | "amber" | "terracotta" | "indigo" | "rose" | "teal";

export type PeriodSlot = {
  id: string;
  name: string;
  start: string;
  end: string;
};

export type ClassEntry = {
  id: string;
  periodId: string;
  day: DayKey;
  subject: string;
  room: string;
  teacher: string;
  color: SubjectColor;
};

export type ActivityEntry = {
  id: string;
  day: DayKey;
  time: string;
  title: string;
  location: string;
};

export type ScheduleData = {
  studentName: string;
  term: string;
  homeroom: string;
  locker: string;
  periods: PeriodSlot[];
  classes: ClassEntry[];
  activities: ActivityEntry[];
};
