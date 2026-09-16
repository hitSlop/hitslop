import { fail } from "../src/errors.ts";
import { route as productionRoute, type Env } from "../src/index.ts";
import type { Registry } from "../src/store.ts";
import type { Authenticate } from "../src/auth.ts";

// Never imported by the production Worker. Only the local test entry opts in.
export const testAuthenticate: Authenticate = async (request) => {
  const match = /^Bearer test:([a-zA-Z0-9_-]{1,128})$/.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match) return fail("Unauthorized", 401);
  const uid = match[1]!;
  return { uid, name: uid, email: `${uid}@example.test` };
};
export const route = (request: Request, env: Env, registry?: Registry) =>
  productionRoute(request, env, registry, testAuthenticate);
