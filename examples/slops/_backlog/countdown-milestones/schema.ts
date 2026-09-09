import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const milestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  done: z.boolean(),
});

const countdownSchema = z.object({
  title: z.string().min(1).max(100),
  createdAt: date,
  targetDate: date,
  targetTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  milestones: z.array(milestoneSchema).max(25),
});

export type CountdownData = z.infer<typeof countdownSchema>;
export default countdownSchema;
