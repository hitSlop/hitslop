import { route, type Env } from "./index.ts";
export { SlopRoom } from "./room.ts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;
