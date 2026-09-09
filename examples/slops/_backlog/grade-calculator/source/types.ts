export type CategoryWeight = {
  id: string;
  name: string;
  weightPercent: number;
  scorePercent: number | null;
  isFinal: boolean;
};

export type CourseGrade = {
  id: string;
  code: string;
  name: string;
  credits: number;
  targetPercent: number; // e.g. 90 for A
  categories: CategoryWeight[];
};

export type GradeCalculatorData = {
  studentName: string;
  term: string;
  courses: CourseGrade[];
};
