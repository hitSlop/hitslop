export type AssignmentCategory =
  | "Homework"
  | "Reading"
  | "Essay"
  | "Problem Set"
  | "Lab Report"
  | "Project"
  | "Quiz Prep";

export type Course = {
  id: string;
  code: string;
  name: string;
  colorHex: string;
};

export type Assignment = {
  id: string;
  courseCode: string;
  title: string;
  dueDate: string;
  category: AssignmentCategory;
  points: number;
  completed: boolean;
  notes: string;
};

export type AssignmentTrackerData = {
  studentName: string;
  term: string;
  courses: Course[];
  assignments: Assignment[];
};
