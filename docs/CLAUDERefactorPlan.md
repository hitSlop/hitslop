# Shared TypeScript authority — review, simplification, and cleanup

## Context

The `refactor` branch replaced Swift's duplicate document-ops implementation with one
TypeScript evaluator (`@hitslop/state-core`) executed in JavaScriptCore on Apple and
directly in V8 in the Cloudflare Durable Object. Net **−725 lines**, and five Swift files
deleted (`SlopDocumentOps.swift` 205, `SlopDocumentJSON.swift` 163, `SlopDocumentFormat.swift`
158, `SlopDocumentSchema.swift` 92, `SlopJSONValidation.swift` 20), plus the
`swift-dynamicjson` dependency.

**The architecture is right and it has already landed. Do not relitigate it.** This plan is
about three things: the redundant work still on the hot path, the code that can now be
deleted, and one protocol decision that needs making before a whiteboard-class app forces it.

Two external reviews were supplied. Both independently endorse the architecture and the
"keep TypeBox" conclusion. I fact-checked their specific claims — several are wrong, and both
miss the two largest issues. Scorecard in the appendix.

---

## Verdict on the two reviews

**Adopt (highest value first):**

1. **"Stop requiring Swift to send the entire JSON document back after every operation."**
   This is the single most valuable idea in either document, and the committed benchmark data
   confirms it. In `docs/benchmarks/javascriptcore-results.json`, `authorityP95Ms` is
   **327 ms of the 338 ms** command-to-layout p95 at 14k rows — ~97%. WebKit transport and
   layout are ~11 ms. The cost is entirely inside the authority call, and it is
   O(document) per command regardless of op size.

2. **Three-tier state model** (durable / presence-ephemeral / local). Adopt the *concept and
   API shape* now, because it is a protocol decision. Not the vendor.

3. **Determinism as an enforced test, not a doc rule.** `executeCommand` already takes `now`
   as a parameter (`packages/state-core/src/index.ts:58`) — the design is already correct.
   Add a build assertion so it stays that way.

4. **Keep TypeBox.** Both reviews say this; I agree, for a stronger reason than either gives:
   the schema-walking core (`documentMeta`, `documentMapping`, `recordValueSchema`,
   `applicationSchema` in `packages/schema/src/document.ts`) operates on JSON Schema nodes
   *directly*. Zod would mean rewriting that core for zero gain. Non-starter.

**Reject:**

- **Liveblocks.** You already have the authority: `apps/cloudflare/src/room.ts` (488 lines)
  is a working single-threaded, transactional, strongly-consistent serializer that imports
  `executeCommand` directly. Adopting Liveblocks means running *two* sets of merge semantics,
  a per-seat cost, a vendor dependency in the critical path, and handing a room-scoped
  credential into a WebView that runs untrusted third-party slop code. It also breaks the
  property that makes `.slop` good: the file works offline, forever, without a service. The
  genuinely useful content of that document is the three-tier state model — which is a
  protocol design you can implement on your own DO for a fraction of the effort. Durable
  Objects already *are* the thing Liveblocks resells.
- **Zod / Valibot migration.** No benefit, large cost. Closed.
- **The first review's "in-VM revision-keyed snapshot cache" as the top priority.** It removes
  1 of ~8 full-document passes and introduces mutable state the spike explicitly warned
  against. Do the copy elimination first; re-measure; this may never be needed.

---

## The actual problem: ~8 full-document passes per command

Traced through `SlopCommandStorage.apply` → `jsc.evaluate` → `executeCommand` → `applyOps`,
a single boolean toggle on a 14k-row document does this:

| # | Pass | Location |
|---|------|----------|
| 1 | `JSON.parse` of committed snapshot | `jsc.ts:186` |
| 2 | `structuredClone` = stringify… | `document-ops.ts:96` (polyfill is a JSON round-trip) |
| 3 | …+ parse | same |
| 4 | `assertJSON` recursive walk | `document.ts:184` via `prepareDocument` |
| 5 | TypeBox `Check` of whole document | `document.ts:185` |
| 6 | `JSON.stringify` | `document.ts:186` |
| 7 | **`TextEncoder` polyfill byte count** | `document.ts:187` — builds a ~1M-element JS array |
| 8 | `stringify` again in `snapshotView` | `jsc.ts:51` — discards `prepared.json`, already built |
| 9 | `stringify` a third time for `data` | `jsc.ts:54` |

Plus Swift: SQLite read of ~969 KB, two JSC↔Swift string conversions, SQLite write with
`synchronous=FULL`.

Passes 7, 8 and 9 are **pure waste with no behavioural change** — that is the cheap win.
Passes 2, 3, 4, 5 are the structural win.

### Bundle regression: `core-js-pure` URL polyfill

`scripts/generate-state-engine.ts` now bundles `core-js-pure/actual/url` with the comment
*"TypeBox resolves $ref/$id using WHATWG URL. Bare JavaScriptCore has no URL API."* This is
the cause of **172 KB → 249 KB (+44%)**, and it is paid on every one of the **7**
`StateEngine()` construction sites, several of which are one-shot throwaway engines.

A slop's `data.schema.json` is a single self-contained document. `$ref`/`$id` to an external
URL is also a resolution vector you do not want in a trusted context. Rejecting them in
`checkSchema` (`jsc.ts:30`) lets the whole polyfill go.

---

## Work plan

### P0 — Delete waste on the hot path (no behaviour change)

**`packages/schema/src/document.ts`** — replace `encoder.encode(json).byteLength` (line 187)
with an arithmetic UTF-8 length. Native-regex ASCII fast path first
(`!/[\u0080-\uffff]/.test(s)` → `bytes === s.length`), else count via `charCodeAt` with no
array and no `Uint8Array` allocation. Same change in `boundedData` (`jsc.ts:81-85`).
The existing polyfill is **byte-exact correct** (I verified it against the real `TextEncoder`
for lone surrogates, emoji, and precomposed vs decomposed) — this is purely about cost.

**`packages/state-core/src/jsc.ts`** — `evaluate` (line 185) must reuse
`evaluated.prepared.json`, which `prepareSnapshot` (`index.ts:49`) already built, instead of
re-stringifying via `snapshotView`. Thread `prepareDocument`'s `json` through for the `data`
field too. Removes passes 8 and 9.

**`packages/state-core/src/document-ops.ts`** — replace whole-document `structuredClone`
(line 96) with copy-on-write along `op.path`. `resolve()` (line 34) already walks exactly that
path, so this is ~40 lines and no dependency. Keep the full clone only for `replace`. Do not
add Immer/mutative.

### P0 — Drop the URL polyfill

Reject `$ref` and `$id` in `checkSchema` (`jsc.ts:30`), then remove the `core-js-pure` bundle
from `scripts/generate-state-engine.ts`. Verify no TypeBox path still reaches `URL`; if one
does, a throwing stub is sufficient and is ~10 lines. Target: back under 180 KB.

### P0 — Engine lifecycle

Seven `StateEngine()` sites remain; four are throwaway one-shot engines on cold-but-common
paths: `SlopCloudAPI.swift:46`, `SlopCommandDocument.swift:110` (`inspector`),
`SlopPackage.swift:264` and `:339`. Each pays a fresh `JSVirtualMachine`, a thread, and a
full parse of the bundle — `61.7 ms` cold p95 when the bundle was 172 KB. Package/manifest
validation runs on catalog browsing and every open.

Split into two lifetimes:
- **Shared stateless utility engine** (lazy singleton, serialized) for schema-free calls:
  `manifest`, `applicationSchema`, `bridge`, `canonical`, `validateRoom`, `seed`.
  The spike's contention finding applies to the *edit* path, not to these.
- **Per-document engine** (unchanged) for `configure`/`evaluate`/`request`/`snapshot`.

Then add JSC **bytecode caching** — `JSScript(source:in:withSourceURL:andBytecodeCache:)` +
`evaluateJSScript(_:)` — so repeated context creation skips parse/compile. Apple-native, no
dependency, directly targets the remaining cold starts.

### P0 — `callAsync` blocks a cooperative thread

`StateEngine.swift:135` wraps a **blocking** `lane.sync` + `NSLock` in `Task.detached`. The
Swift concurrency pool is sized to core count; with many open documents this can starve or
stall it. Convert `call` to `withCheckedThrowingContinuation` over an async lane submit.

### P1 — Structural: validate the touched subtree

`prepareDocument` re-validates the entire document on every command (passes 4 and 5). `applyOps`
knows the exact touched paths. Validate the addressed slot's subschema, then still enforce
depth and the 1 MiB bound on the assembled JSON. Keep full validation for `replace` and `undo`.
Combined with the P0 items this takes ~8 passes to ~2.

Gate this on re-measurement: you called 14k rows a stress ceiling, so if P0 alone brings
typical documents into the tens of milliseconds, stop here.

### P1 — Rename to `@hitslop/document-engine`

Per your choice. Rename package, Swift target `HitSlopStateEngine` → `HitSlopDocumentEngine`,
resource `state-engine.js` → `document-engine.js`, `scripts/generate-state-engine.ts`.
**Also stop exporting `./jsc`** — it is generated host-adapter code in the same family as
`host-bridge.js`, not an npm API anyone should import.

### P1 — Structured errors across the bridge

`invoke` collapses every throw to `{error: string}` (`jsc.ts:354`), losing the error codes
that `failure()` carefully preserves. Return `{error:{code,message}}` so Swift can branch
and localize rather than string-match.

### P2 — Protocol headroom for whiteboard-class apps

Do not build presence now. Do make two decisions now so you are not blocked later:

1. **Snapshot vs delta on the return path.** Version the host→guest frame so it can carry
   `{revision, ops}` instead of a full snapshot, without changing the slop-facing API.
   `createDocumentController` already reconciles confirmed snapshots and
   `{@attach store.text()}` already keeps local drafts off the authority path — the precedent
   exists. This is the escape hatch that makes 60 Hz pointer input tractable later.
2. **Reserve an ephemeral channel** in the room protocol (`packages/schema/src/room.ts`)
   for presence/cursor traffic that is broadcast-only and never persisted, never validated
   against the document schema, and never touches SQLite.

### P2 — Determinism assertion

Add a check to `scripts/generate-state-engine.ts` (or `check-generated`) that the emitted
bundle contains no `Date.now`, `Math.random`, `crypto.`, or `fetch`. The design is already
correct; this keeps it correct.

---

## Code to kill

| Target | Why |
|---|---|
| `core-js-pure/actual/url` in `scripts/generate-state-engine.ts` | ~70 KB / 28% of bundle, for `$ref` resolution you should forbid anyway |
| `structuredClone` of whole document, `document-ops.ts:96` | replaced by path copy |
| `TextEncoder` polyfill allocation, `document.ts:187` + `jsc.ts:83` | replaced by arithmetic count |
| Duplicate `stringify` in `snapshotView`, `jsc.ts:51,54` | `prepared.json` already exists |
| `request` + `evaluate` two-round-trip, `SlopCommandStorage.swift:293,315` | fold into one lane crossing |
| Redundant `snapshot` re-validation, `SlopCommandDocument.swift:82,88` | re-validates data `evaluate` just produced |
| `Spikes/JavaScriptCore/{Engine,Storage,WebBenchmark}.swift` + benchmark mode of `Main.swift` (~730 lines) | shared-vs-independent VM question is settled; **keep `Production.swift`** as the ongoing regression harness |
| 4 throwaway `StateEngine()` sites | replaced by shared utility engine |

Also: `scripts/benchmarks/javascriptcore/summarize.ts` **discards** the per-stage timings
(`parseMs`, `evaluateMs`, `loadMs`, `saveMs`, `queueMs`) that `Storage.swift` already
records. Retain them — the instrumentation the first review asks for already exists, it is
only being thrown away by the summarizer.

---

## Verification

```sh
bun run --cwd packages/state-core test      # 31-case corpus incl. surrogates, __proto__, Unicode
bun run test                                # full workspace
bun run schema:check                        # generated-artifact drift, covers the bundle
swift test --package-path apps/apple/Packages/HitSlopApple   # StateEngineTests, DocumentOpsTests
bun scripts/benchmarks/javascriptcore/run.ts && bun scripts/benchmarks/javascriptcore/summarize.ts
```

Specific gates:
- **Correctness unchanged**: 31/31, and the Swift `Fixtures/native-engine.json` corpus must
  still pass — the same fixtures now run in Bun, JSC and workerd. Any P0/P1 change that alters
  a single fixture result is wrong.
- **Bundle** back under 180 KB; re-run cold-init and confirm p95 < 100 ms at the new size.
- **Sub-stage attribution** retained in the committed results JSON, so the next person can see
  where the time goes without re-deriving it.
- **Production harness**: run `Production.swift` (real package/session/bridge/SQLite) before
  and after, on real Quick Checklist sizes — not only the synthetic 14k-row checkbox list.
- **Memory**: 20 open documents should not regress past the measured 234.8 MiB; the shared
  utility engine should reduce it.

---

## Appendix — fact-check of the supplied reviews

Verified against the code, not taken on trust.

| Claim | Verdict |
|---|---|
| "`TextEncoder` shim maps lone surrogates to U+FFFD, so the 1 MiB gate is fiction" | **False.** Byte-exact with the real `TextEncoder` (3 bytes) — that *is* the WHATWG behaviour. Moot anyway: `JSON.stringify` escapes lone surrogates to ASCII before the encoder sees them. The shim's problem is cost, not correctness. |
| "`packages/schema/tests/document-boundaries.test.ts` still imports deleted `document-ops.ts`" | **False.** No dangling imports anywhere in the repo. |
| "`docs/storage.md` still says a Swift actor applies commands and `user_version = 3`" | **False.** It says `user_version = 4` and already describes the per-document JavaScriptCore VM and `@hitslop/state-core` accurately. |
| "Confirm TypeBox `Compile` works in no-JIT JSC — it uses `new Function`" | **False premise.** TypeBox 1.x `Compile` is a closure-tree compiler, no `new Function`. Verified empirically. The silent `catch` fallback in `validation.ts:17` is still worth making observable, but the risk described does not exist. |
| "Bundle is 173 KB" | **Stale.** Now 249 KB, because of the `core-js-pure` URL polyfill added since. |
| In-VM snapshot cache is "the highest-leverage follow-up" | **Mis-prioritized.** Removes 1 of ~8 passes and adds mutable state. Do copy elimination first. |
| Keep ops semantic, not JSON Patch; constrain state to JSON values; forbid `__proto__`; validate op then result; determinism rules | **Already done.** `put()` uses `Object.defineProperty`, `assertJSON` enforces depth/size, `executeCommand` takes `now` as a parameter, and the corpus covers `__proto__` and surrogates. |
| Keep TypeBox, not Zod/Valibot | **Agree**, for a stronger reason: the schema-walking core operates on JSON Schema nodes directly. |

Both reviews missed: the 7 engine construction sites and their throwaway instances, the
`callAsync` cooperative-pool hazard, the `snapshotView` double-stringify, JSC bytecode
caching, the `core-js-pure` bundle regression, and that the summarizer discards the
sub-stage timings.

Codex has since fixed, unprompted: the `methods[method]` prototype-dispatch footgun (now
`Object.hasOwn`, `jsc.ts:351`), `configure` memoization on `schemaSource`, arg marshalling
(no more `JSONEncoder` round-trip), JSON Schema meta-validation via `checkSchema`,
`boundedData` on `replace`/`external`, `RequestSchema` validation in `executeMessage`,
surrogate sanitization of native-facing error messages, and a real production benchmark
harness in `Spikes/JavaScriptCore/Production.swift`.
