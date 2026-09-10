import * as Type from "typebox";

const skill = Type.Object({
  id: Type.String(),
  label: Type.String(),
}, { additionalProperties: true });

const experience = Type.Object({
  id: Type.String(),
  role: Type.String(),
  company: Type.String(),
  period: Type.String(),
  summary: Type.String(),
}, { additionalProperties: true });

const education = Type.Object({
  id: Type.String(),
  school: Type.String(),
  program: Type.String(),
  year: Type.String(),
}, { additionalProperties: true });

const resumeSchema = Type.Object({
  name: Type.String(),
  initials: Type.String(),
  role: Type.String(),
  email: Type.String(),
  location: Type.String(),
  website: Type.String(),
  summary: Type.String(),
  skills: Type.Array(skill),
  experience: Type.Array(experience),
  education: Type.Array(education),
}, { additionalProperties: true });

export type Resume = Type.Static<typeof resumeSchema>;
export default resumeSchema;

export function badgeInitials(name: string, initials: string): string {
  const fromName = name.split(/\s+/).filter(Boolean).map(word => word[0] ?? "").join("").slice(0, 2).toUpperCase();
  return (initials.trim() || fromName || "AQ").slice(0, 2).toUpperCase();
}
