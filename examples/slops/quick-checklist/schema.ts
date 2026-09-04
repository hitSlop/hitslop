import { z } from "zod";

const checklistSchema = z.object({
  title: z.string(),
  tasks: z.array(z.object({
    id: z.string(),
    text: z.string(),
    done: z.boolean(),
    archived: z.boolean().default(false),
  })),
});

export type Checklist = z.infer<typeof checklistSchema>;
export default checklistSchema;
