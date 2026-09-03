import * as z from "zod";

export default z.object({
  count: z.number().int().describe("Current tally count value"),
});
