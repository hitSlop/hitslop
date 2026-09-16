import { createORPCClient } from "@orpc/client";
import type { RouterContractClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi/fetch";
import { api } from "./contract.js";

export type APIClient = RouterContractClient<typeof api>;
export function createAPIClient(
  origin: string | URL,
  options: {
    authorization?: () => Promise<string | undefined> | string | undefined;
    fetch?: typeof globalThis.fetch;
  } = {},
): APIClient {
  return createORPCClient(
    new OpenAPILink(api, {
      origin: new URL(origin).origin,
      headers: async (_options, _path, input) => {
        const token = await options.authorization?.();
        return {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(input instanceof Blob && input.type ? { "content-type": input.type } : {}),
        };
      },
      ...(options.fetch ? { fetch: options.fetch } : {}),
    }),
  );
}
