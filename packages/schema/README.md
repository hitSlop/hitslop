# @hitslop/schema

Authoritative TypeBox schemas and signed-publish protocol types for hitSlop.

```ts
import { parseManifest } from "@hitslop/schema";

const manifest = parseManifest(JSON.parse(source));
```

The package also exports `./manifest.schema.json`. In the monorepo, TypeBox is the
source of truth; `bun run schema:generate` updates committed JSON Schema,
fixed Swift Codable models. Apple validation uses the generated
`@hitslop/document-engine` JavaScriptCore bundle.

Author with `import * as S from "@hitslop/schema/document"` and `S.Document`.
The CLI and guest import the same schema; no generated validator is required.
TypeBox validates values without coercing, inserting defaults, or removing fields.

Document schemas use a closed subset of JSON Schema draft 2020-12. A shared
checker validates definitions at every ingress, including direct TypeBox imports.
Supported nodes are strings, numbers, integers, booleans, null, scalar literals
and enums, finite unions, objects, records, identity lists, atomic arrays and the
canonical media descriptor. Supported constraints are string lengths, numeric
minimum/maximum, array lengths and uniqueness, plus title/description annotations.
Objects may preserve unknown data with `additionalProperties: true`.

References, definitions, identifiers, recursion, arbitrary patterns/formats,
conditional/intersection schemas, defaults and unknown schema keywords are
rejected. Defaults belong in `initial.ts`. The canonical unrestricted record
pattern and media descriptor are explicit exceptions. Validation limits schema
depth and node count; this is not a general-purpose JSON Schema implementation.
Trusted bridge/manifest/OpenAPI generation uses a separate internal pipeline.

`@hitslop/schema/validation` caches TypeBox validators and exposes acceleration
and fallback counters through `validationDiagnostics()`. `@hitslop/schema/json`
provides plain-JSON checks and allocation-free UTF-8 byte counting.

Documentation: [Package format](https://github.com/hitslop/hitslop/blob/master/docs/package-format.md)

MIT © 2026 hitSlop contributors.
