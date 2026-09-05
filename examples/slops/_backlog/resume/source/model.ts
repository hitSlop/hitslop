export type ItemID = string | number;
export type Skill = { id: ItemID; label: string } | string;
export type Experience = { id: ItemID; role: string; company: string; period: string; summary: string };
export type Education = { id: ItemID; school: string; program: string; year: string };

export type Resume = {
  name: string;
  initials?: string;
  role: string;
  email: string;
  location: string;
  website: string;
  summary: string;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
};
