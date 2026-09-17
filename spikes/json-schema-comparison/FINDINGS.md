# Findings: DynamicJSON vs swift-json-schema

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
