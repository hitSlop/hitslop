# @hitslop/document-engine

The shared hitSlop document evaluator. Apple runs the generated bundle in one
JavaScriptCore VM per document; Cloudflare and browser previews import TypeScript.

The root export provides `executeCommand`, `applyOps`, and `prepareSnapshot`.
Evaluation is deterministic: callers supply the schema, committed snapshot,
lease, receipt, undo slot, prepared command and current time. The host commits
the resulting snapshot and receipt atomically before acknowledging or publishing.
The evaluator performs no storage, network, clock or identity-generation work.

`@hitslop/document-engine/web` supplies Web Crypto request preparation, lease creation,
and the disposable in-memory preview authority. The private Apple adapter supplies
the generated JSON string ABI with structured error codes; it is not an npm export.
Swift decodes fixed metadata only; application values, schema content and operations
remain JSON text. The VM executes trusted bundled
code, never slop-authored JavaScript, and retains validators rather than document
state.

Run `bun run schema:generate` from the repository root to regenerate the Apple
resource and native parity fixtures. The Apple build includes JSON cloning and
a small UTF-8 encoder for TypeBox uniqueness checks. Document sizing uses arithmetic
byte counting. The generator checks the emitted bundle for nondeterministic APIs
and enforces a 180 KB limit.

Document schemas use the [closed hitSlop language](../schema/README.md); references
and arbitrary JSON Schema extensions are rejected. The Apple adapters are not
imported by the pure evaluator or Cloudflare.

SQLite, projections, media, networking and WebKit stay in the native host.
See [storage](../../docs/storage.md) and the
[engine measurements](../../docs/benchmarks/javascriptcore.md).
