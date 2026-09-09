export type MilestoneType = "Exam" | "Paper" | "Project" | "Presentation" | "Break" | "Deadline";

export type CourseTag = {
  code: string;
  name: string;
  colorHex: string;
};

export type Milestone = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  courseCode: string;
  type: MilestoneType;
  notes: string;
};

export type SemesterData = {
  termTitle: string;
  academicYear: string;
  startMonth: string; // "2026-09"
  courses: CourseTag[];
  milestones: Milestone[];
};
