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

Document schemas use JSON Schema draft 2020-12. An omitted `$schema` receives
that dialect during packaging; an explicitly different dialect is rejected.
Tooling uses Ajv compilation to reject malformed schemas, unknown formats and
keywords, and unresolved references, then TypeBox to validate values. Validation
does not coerce values, fill defaults, or remove fields. The shared JS/Swift
conformance fixtures cover document values and format assertions. Native package
opening decodes immutable schema metadata; mutable data is validated when the
store is accessed so the guest can report recoverable errors.

Documentation: [Package format](https://github.com/hitslop/hitslop/blob/master/docs/package-format.md)

MIT © 2026 hitSlop contributors.
