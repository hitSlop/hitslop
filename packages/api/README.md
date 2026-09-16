# @hitslop/api

The public HTTP contract for hitSlop. TypeBox owns JSON shapes in
`@hitslop/schema`; oRPC adds routes, validation, errors, and typed calls.

```ts
import { createAPIClient } from "@hitslop/api/client";
const api = createAPIClient("https://api.hitslop.com");
const page = await api.catalog.list({ limit: "50" });
```

Supply `authorization: async () => token` for authenticated operations. The
provider runs for each call. Room operations require a room token. File uploads
use `File` for multipart and `Blob` for raw media. Credentials belong to the host.

From the repository root, `bun run schema:generate` emits OpenAPI 3.1 into
`generated/openapi.json` and the Apple `HitSlopAPI` target. SwiftPM's official
OpenAPI generator builds the Swift client and Codable message enums. No Swift
source is rewritten or checked in for these APIs. `bun run schema:check` verifies
that committed specifications and native resources match their sources.

WebSockets carry the explicit room message variants from `packages/schema`.
They are OpenAPI components for code generation, not HTTP/oRPC procedures.
Worker-to-room operations use Cloudflare's native typed Durable Object RPC.
The small Standard Schema adapter preserves input JSON without coercion or
inserting defaults; binary files are validated separately as transport values.

The oRPC packages are pinned together to `2.0.0-beta.36`. TypeBox is `1.3.32`.
