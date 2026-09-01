# @hitslop/schema

Authoritative Zod schemas and signed-publish protocol types for hitSlop.

```ts
import { parseManifest } from "@hitslop/schema";

const manifest = parseManifest(JSON.parse(source));
```

The package also exports `./manifest.schema.json`. In the monorepo, Zod is the
source of truth; `bun run schema:generate` updates committed JSON Schema,
Swift Codable models, and the bundled Apple validation resource.

Documentation: [Package format](https://github.com/hitslop/hitslop/blob/main/docs/package-format.md)

MIT © 2026 hitSlop contributors.
