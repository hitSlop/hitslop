import { route } from "./test-auth.ts";
import type { Env } from "../src/index.ts";
export { SlopRoom } from "../src/room.ts";
export default {
  fetch: (request: Request, env: Env) => route(request, env),
} satisfies ExportedHandler<Env>;
