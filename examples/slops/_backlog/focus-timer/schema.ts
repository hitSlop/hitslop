import { z } from "zod";

const timerSchema = z.object({
  focusMinutes: z.number().int().min(1).max(120),
  restMinutes: z.number().int().min(1).max(60),
  history: z.array(z.object({
    startedAt: z.string(),
    kind: z.enum(["focus", "rest"]),
    seconds: z.number().int().nonnegative(),
  })).max(12),
});

export default timerSchema;
