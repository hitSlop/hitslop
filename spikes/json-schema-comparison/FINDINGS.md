# Findings: JSON compatibility

## Implemented follow-up: boundaries and records

The first three fixes from the baseline review below are now implemented while
retaining DynamicJSON. Documents keep their 64-container, 1 MiB limits; native
codecs allow 68 containers for bounded framing, and assembled snapshot bytes are
checked before persistence. Exact encoded-byte checks cover local preparation
and incoming shared data. Both preliminary byte walkers avoid counting a trailing
separator.

`S.Record` now emits `^[\\s\\S]*$`, and its mappings, paths, command interpreters,
and native attachment discovery use that representation. Old annotated `^.*$`
record schemas require a rebuild. Active examples and the starter are verified;
archives remain deferred. The wider workspace also contains concurrent undo and
protocol changes; these are not part of the JSON boundary fix.

Permanent regressions cover SQLite commit/reopen/retry, exact byte limits,
rejected shared data, room ready/snapshot messages, record edits, and attachment
discovery. The spike adds the ready envelope and uses the current generated
bridge contract. Follow-up artifacts: [first run](results/boundaries-fixed-first.json),
[second run](results/boundaries-fixed-second.json), and
[stability comparison](results/boundaries-fixed-stability.json).

Each follow-up run executes 1,437 case validations and 99 boundary checks. Boundary
failures fall from **6 to 0**; all record cases agree with their intended contract.
Case differences fall from **48 to 38**, with **0 unstable sequences**. The remaining
14 schema-export differences are confined to the candidate library. Full spike
runs still intentionally exit 1 for the deferred compatibility differences.

Both reports have identical fixture hashes and semantic outcomes. The strict
provenance comparison remains nonzero: the Apple `Package.resolved` changed during
concurrent dependency work. These reports demonstrate repeated outcomes, not an
identical-source reproducibility gate; the comparison preserves that distinction.

Validation also passed the permanent native boundary/room/media regressions,
TypeScript schema/runtime checks, and Cloudflare tests. Quick Checklist and a
fresh counter starter both built and passed native save/reopen tests. Generated
resources passed their check. Initial WebKit, CLI, and example startup timeouts
under concurrent load passed on scoped reruns (sequential Swift tests and a longer
Bun test timeout); no timeout-related production changes were made.

Unicode key preservation, string equality/length, lone surrogates, and large
integer compatibility remain deferred. The candidate's schema-export metadata
loss remains a separate migration concern. These changes make no speed claim.

## Baseline review, before the follow-up

The review and earlier reports below are preserved as the before-change evidence.
Items 1–3 in its proposed production work are completed by the follow-up above.

## Baseline recommendation

Keep the current dependency while fixing the shared document contract and native
representation. Neither Swift library is compatible with the expanded corpus
without adaptation. The candidate improves scalar equality but still merges
canonically equivalent object keys, counts graphemes for string length, and
accepts an overflowing number outside the guest's finite-number domain.
A dependency swap alone would leave data-loss and persistence failures in place.

This implementation adds a reproducible spike and an opt-in production test
adapter. It does **not** fix production behavior or change dependencies.

## Baseline results

The current corpus produces **479 adapter/case rows, 1,437 executions, 126 schema
checks, and 88 boundary checks** per run. There are **48 differing case rows,
14 schema-export differences, and 6 boundary failures**, with no unstable repeated
sequences. Counts span adapters, so they are not counts of distinct production
bugs. Both full runs intentionally exit 1 when these differences are recorded.

Artifacts: [first compatibility run](results/compatibility-first.json),
[second compatibility run](results/compatibility-second.json), and
[repeatability check](results/compatibility-stability.json). The repeatability
check compares source and fixture hashes as well as semantic results; serialization
order and diagnostic wording are excluded. The measured versions are TypeBox
1.3.32, DynamicJSON 1.0.2, and swift-json-schema 0.14.1.

| Observation | TypeBox compiled/interpreted | Production native / cached DynamicJSON | Candidate |
| --- | --- | --- | --- |
| Distinct combining Unicode keys survive | Yes | No | No |
| Exact scalar `const` / `enum` equality | Yes | No | Yes |
| Two-scalar combining/flag strings satisfy length 2 | Yes | No | No |
| Distinct Unicode strings/nested values remain unique | Yes | No | Yes |
| Distinct Unicode object keys remain unique | Yes | No | No |
| Decomposed spelling cannot satisfy a different required key | Yes | No | No |
| Record values under newline/CR keys are validated | No | No | No |
| Unpaired surrogate input accepted by the guest can round-trip | Yes | No | No |
| Finite `1e20` satisfies `integer` | Yes | No | Yes |
| Overflowing `1e400` is rejected | Yes | Yes | No |

The record failures are **schema-authoring defects**: `S.Record` emits `^.*$`,
which misses keys containing line terminators. All adapters follow that schema
and accept a string where the author requested numeric record values. These are
not evidence of different JSON Schema semantics between libraries.

Unpaired surrogates are a **portability policy gap**: JavaScript accepts escaped
lone UTF-16 surrogates while the Swift parsers reject them. This corpus establishes
the parser/validator mismatch; it does not exercise a remote room authority.
Choose and enforce a shared representable domain before accepting such data.

The 14 schema differences are the candidate's export of authored document
schemas: root `x-hitslop` annotations disappear from `Schema.jsonValue`. Schema
acceptance itself agrees. Retaining the original schema source, as the native
adapter already does, avoids that export loss. It does not fix document key loss.

Current protocol-2 bridge cases, recursive document references, configured email
formats, unknown fields, missing defaults, coercion rejection, and mixed repeated
valid/invalid sequences pass. Rejected values remain unchanged where parsing can
represent them. Neither adapter sequence exhibits stale validation state.

## Native persistence and size findings

The native adapter calls the actual `SlopDocumentSchema.prepare` and
`SlopCommandStorage.apply` APIs against fresh temporary SQLite databases.

- **Depth 64 commits but cannot reopen.** The prepared data passes its own depth
  check. Storage adds a snapshot envelope around the prepared bytes without
  checking combined depth. A new connection's load and the retry path then fail.
  The disk projection and room snapshot envelope also exceed the allowed depth.
- **Depth 63 fails the room snapshot envelope.** The stored snapshot can reopen,
  but adding the outer room message crosses the same depth limit. Depths 60–62
  pass every tested stage; depth 65 rejects and leaves the snapshot unchanged.
- **Exactly 1 MiB is inconsistently accepted.** A plain `{"text":"..."}` value
  of 1,048,576 encoded bytes is rejected, while an escaped value of the same size
  passes. `SlopDocumentJSON.validateBounds` adds `key.utf8.count + 4` for each
  property, counting a separator for the final property. For this plain one-field
  object it overestimates by one byte and rejects before the exact encoded-byte
  check. Escaped strings are underestimated by that preliminary count and reach
  the exact check. Values one byte over the limit correctly reject.

Full replacement requests near 1 MiB exceed the separate bridge request budget
because of command overhead. Those transport rejections are expected and are
reported separately from document acceptance. The spike uses a small deep edit
to reach depth limits and directly invokes authority validation for size cases.
It checks real envelope shapes through encoding/decoding, not live WebKit or
network delivery. See [README](README.md) for the scope and oracle semantics.

## Proposed production work, in order

1. **Make committed documents readable at every required boundary.** Separate
   document depth from bounded envelope overhead, or consistently reduce the
   public data limit. Validate the chosen invariant before commit. Promote the
   depth 63/64 reopen, retry, projection, and room cases into regression tests.
2. **Remove false rejection by the approximate byte counter.** A preliminary
   bound must be conservative before the authoritative encoded-byte check.
   Keep both plain and escaped exact-limit tests and verify rejected edits do
   not advance revision or receipts incorrectly.
3. **Fix record schema generation.** Emit an all-key pattern or equivalent schema
   that constrains values for every JSON property name. Regenerate native
   resources and verify newline, CR, empty, and prototype-like keys across runtimes.
4. **Preserve exact JSON keys in native data and schema handling.** Swift String
   dictionary equality cannot distinguish canonical equivalents. Changing only
   validator libraries is insufficient; parsing, key storage, lookup, operation
   paths, schema properties, and serialization must agree on exact key identity.
5. **Close remaining validator and portability gaps.** Use code-point string
   lengths and exact deep equality, support finite integral guest numbers beyond
   Int64, and define a consistent policy for lone surrogates and overflowing
   literals. Apply any rejection rule at both guest and authority boundaries.
6. **Reevaluate the dependency with the same corpus.** Preserve original schema
   metadata, require whole-value validation, and only compare fresh performance
   once the required correctness cases pass. The candidate's scalar-equality
   improvement is useful evidence, but not enough to justify a migration yet.

## Historical benchmark — prior corpus

The remainder preserves the original microbenchmark findings. Its older bridge
fixtures and Foundation-based oracle did not expose the Unicode and persistence
issues above. Statements that all validity checks match apply only to that older
corpus. Validator reuse has since been implemented in production, so the old
recommendation to add caching is no longer outstanding work. The original result
files are retained unchanged. These timings are not protocol-2 end-to-end results.


## Recommendation

Keep DynamicJSON and investigate reusing its validator, especially for bridge
requests. Both release runs show a much larger gain from removing repeated
validator construction than from changing libraries. No production change is
included in this spike.

swift-json-schema is a viable validator for this corpus after configuring formats
and explicitly validating schemas. Its structured diagnostic output is useful,
but it does not yet provide a compelling migration benefit for hitSlop's measured
workloads. A migration would also need to preserve the original schema separately
from `Schema.jsonValue`.

## Compatibility

Each run uses 62 document/input cases across three adapters, with three passes
through each prepared validator: **186 case records and 558 case executions**. All
expected validity outcomes match. Unknown document fields survive and no coercion,
default insertion, or field stripping is observed. Reused validators produce
consistent results across the repeated valid/invalid sequences. This includes
the shared TypeBox/Swift corpus; this experiment does not run a third validator.

Of **54 schema checks**, 53 match fully. All three adapters correctly accept or
reject the supplied schemas. The one preservation difference is Quick Checklist
through swift-json-schema's `Schema.jsonValue`: its root `x-hitslop` annotation is
omitted. The library's [schema export implementation](https://github.com/ajevans99/swift-json-schema/blob/v0.14.1/Sources/JSONSchema/Schema%2BJSONValue.swift)
reconstructs objects from registered keywords, rather than preserving every root
field. This does **not** mean it drops fields from document data or that validation
fails. hitSlop's `SlopDocumentSchema` already retains its original source separately;
a migration should preserve that design instead of exporting through `Schema.jsonValue`.

Both runs intentionally return status **1** when this preservation difference is
recorded. An exit of 0 would hide a material integration difference.

The candidate adapter supplies `DefaultFormatValidators.all`, replaces URI and
URI-reference validators with hitSlop's rules, and calls
`validateAgainstMetaSchema()`. Its constructor alone is not the equivalent of
DynamicJSON's validating schema decoder. Bridge formats remain annotations in
both adapters, matching the current host.

## Diagnostics

For a string in the checklist's boolean `done` field, DynamicJSON already reports
the input path, schema path, and expected/actual types:

```text
value $['tasks'][0]['done'] => "false"
schema: $['properties']['tasks']['items']['properties']['done']['type']
reason: Invalid type; expected boolean but found string
```

The candidate's basic output exposes those details in a standard JSON shape:

```json
{
  "keywordLocation": "/properties/tasks/items/properties/done/type",
  "instanceLocation": "/tasks/0/done",
  "error": "Expected type '[OrderedJSON.JSONType.boolean]' but found 'string'"
}
```

These are shortened excerpts; native output is retained in the result files.
DynamicJSON also has structured error objects; this spike renders its current
text representation. The candidate's advantage here is a ready-made standard
output format, not exclusive access to error locations.

## Measurements

Release build on Apple M1, macOS 26.6.2, Swift 6.4. Pinned versions:
DynamicJSON 1.0.2, swift-json-schema 0.14.1, Swift Collections 1.6.0,
SwiftSyntax 604.0.0. Only the validator product is linked; the candidate's
package-level SwiftSyntax dependency is still resolved. This lockfile requires
Swift 6.2 because of Swift Collections.

The two runs used identical fixture hashes. Both produced 69 timing records,
186 matching case records, one schema-preservation difference, and zero benchmark
correctness errors. Raw results: [first run](results/first.json) and
[second run](results/second.json), recorded on September 17, 2026.

### Parsing plus validation

Second-run **median milliseconds per operation [minimum–maximum batch mean]**.
Each operation parses identical UTF-8 bytes and validates them with the respective
adapter. This is the closer approximation to hitSlop's current validation call.

| Workload | DynamicJSON current | DynamicJSON reused | swift-json-schema reused |
| --- | ---: | ---: | ---: |
| Manifest, valid | 0.388 [0.383–0.434] | 0.125 [0.123–0.135] | 0.286 [0.274–0.292] |
| Manifest, invalid | 0.408 [0.393–0.413] | 0.135 [0.126–0.139] | 0.331 [0.310–0.336] |
| Bridge, valid | 14.158 [13.176–14.432] | 0.184 [0.180–0.193] | 0.822 [0.792–0.857] |
| Bridge, invalid | 12.966 [12.586–13.736] | 0.201 [0.179–0.208] | 0.785 [0.767–0.848] |
| 10 tasks, valid | 0.389 [0.376–0.408] | 0.287 [0.274–0.304] | 0.675 [0.636–1.290] |
| 10 tasks, invalid | 0.350 [0.331–0.357] | 0.328 [0.324–0.354] | 0.603 [0.595–0.680] |
| 100 tasks, valid | 2.843 [2.735–3.105] | 3.016 [2.945–3.191] | 5.921 [5.578–6.146] |
| 100 tasks, invalid | 2.794 [2.702–2.886] | 2.710 [2.667–2.751] | 5.884 [5.782–6.847] |
| 1,000 tasks, valid | 32.112 [28.986–34.431] | 31.415 [28.918–32.656] | 66.737 [64.382–71.648] |
| 1,000 tasks, invalid | 29.091 [28.083–30.916] | 28.802 [28.070–31.746] | 114.160 [98.746–387.163] |

The largest payload is 88,313 bytes. The bridge request is only 125 bytes, but its
schema describes all bridge methods: repeated schema/validator preparation dominates
the current call. In the two runs, reusing DynamicJSON improves that valid bridge
case from **13.780 → 0.215 ms** and **14.158 → 0.184 ms**, approximately **64× and
77×**. Valid manifest calls improve by about **3.1–3.3×**.

The candidate beats the current bridge and manifest convenience calls, but loses
to reused DynamicJSON for both. It is slower than either DynamicJSON path on every
checklist parse-and-validate workload in both runs. Reusing DynamicJSON is not a
consistent win on larger checklists: their current/reused rankings swap between
runs, with overlapping ranges.

The candidate's 1,000-task invalid case is particularly noisy: its median rises
from **63.463 ms** to **114.160 ms**, with a second-run batch as high as **387.163 ms**.
That number should not be treated as a stable slowdown factor. The broader ranking
is consistent without relying on this outlier. Process isolation, thermal state,
and unrelated system work were not controlled.

### Validation of already-parsed values

Selected second-run medians, in milliseconds; all batch ranges are in the raw data.

| Valid workload | DynamicJSON current | DynamicJSON reused | swift-json-schema reused |
| --- | ---: | ---: | ---: |
| Manifest | 0.371 | 0.092 | 0.249 |
| Bridge | 13.987 | 0.160 | 0.809 |
| 10 tasks | 0.265 | 0.176 | 0.518 |
| 100 tasks | 1.772 | 1.747 | 5.883 |
| 1,000 tasks | 18.982 | 22.399 | 56.017 |

Removing JSON parsing does not reverse the main result. Most of the bridge gain
comes from reusing validator state. The large-checklist current/reused differences
are too variable to claim a caching benefit.

### Schema preparation

Second-run median milliseconds [minimum–maximum batch mean]. These are each
adapter's actual setup costs, not identical units of work: the current adapter
defers validator creation to the validation call, while the candidate performs
explicit metaschema validation at setup.

| Schema | DynamicJSON current | DynamicJSON reused | swift-json-schema reused |
| --- | ---: | ---: | ---: |
| Manifest | 1.229 [1.193–1.312] | 1.527 [1.522–1.608] | 13.560 [12.887–14.820] |
| Bridge | 4.971 [4.551–5.682] | 16.786 [16.666–20.037] | 76.609 [74.272–84.553] |
| Checklist | 0.319 [0.310–0.325] | 0.386 [0.364–0.402] | 5.568 [5.232–6.809] |

## Limits and next step

This is a single-machine, sequential microbenchmark with a focused fixture set.
It does not establish full JSON Schema conformance, concurrent safety, memory
usage, binary-size impact, native document latency, or exact-number preservation.
Both libraries construct their normal validation results during timing; diagnostic
rendering and file I/O are excluded. Preparation costs include the candidate's
explicit metaschema validation, while the current DynamicJSON adapter defers some
setup work to each validation. See [README.md](README.md) for the full method.

A follow-up optimization should retain a prepared DynamicJSON validator on the
bridge's existing serial owner, preserve the current dialect and failure behavior,
and exercise actual bridge traffic. Smaller gains on large checklists should be
treated as measurement noise unless reproduced in the host. A library migration
is not recommended based on this spike.
