# @hitslop/schema

Authoritative TypeBox schemas and signed-publish protocol types for hitSlop.

```ts
import { parseManifest } from "@hitslop/schema";

const manifest = parseManifest(JSON.parse(source));
```

The package also exports `./manifest.schema.json`. In the monorepo, TypeBox is the
source of truth; `bun run schema:generate` updates committed JSON Schema,
Swift Codable models, and the bundled Apple validation resource.

Document authoring uses namespace imports (`import * as Type from "typebox"`).
`@hitslop/schema/validation` checks schemas using the TypeBox interpreter;
`@hitslop/schema/json` provides plain-JSON checks. Both are browser-safe.
The CLI evaluates the authored schema to emit packaged JSON Schema. Guest
apps import their schema directly; no generated validator module is required.

Documentation: [Package format](https://github.com/hitslop/hitslop/blob/main/docs/package-format.md)

MIT © 2026 hitSlop contributors.
