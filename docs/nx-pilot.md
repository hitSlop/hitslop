# Nx cache pilot

This experiment covers Daily Planner and Reading Tracker only. It layers Nx 23.2.1
over the existing Bun compiler and native screenshot helper. It does not replace
the release gate, SwiftPM cache, signing, publishing, or the production template
cache. Claude's preceding CI changes are the baseline, not savings attributed to Nx.

## Run it

Use Node 22.23.3 and Bun 1.4.2. On macOS, prepare a matching helper with
`bun run build`, then:

```sh
export HITSLOP_NATIVE_CLI="$PWD/apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native"
export NX_DAEMON=false
export NX_ISOLATE_PLUGINS=false
bun run nx:pilot
```

For a local-only run add `NX_NO_CLOUD=true`. To force actual execution as well,
add `NX_SKIP_NX_CACHE=true`. Neither needs cloud credentials. Linux can run:

```sh
node node_modules/nx/dist/bin/nx.js run-many -t compile -p pilot-daily-planner,pilot-reading-tracker --outputStyle=static
bun scripts/nx-pilot/verify.ts daily-planner --portable
bun scripts/nx-pilot/verify.ts reading-tracker --portable
```

`bun run nx:pilot:evaluate` clones the current tracked/unignored tree into a
disposable directory, installs its dependencies, and runs the direct/cold/warm
comparison and mutation scenarios. It never edits the user's source tree or
copies an Nx cache between machines. JSON results and complete logs land in
`.hitslop/v1-evidence/nx-pilot`. Timing is evidence, not a correctness assertion.

## Cache boundaries

| Task | Inputs | Outputs | Cache |
|---|---|---|---|
| `pilot-runtime:build` | SDK/schema, runtime builder and release ledger, dependencies and tools | Dedicated runtime catalog | Yes; bytes checked against published seals |
| `pilot-{slug}:compile` | Template source, compiler and Svelte plugin, SDK/schema, inherited TS config, copied document skill, dependencies and tools | Portable `.slop` plus checksum | Yes; no native toolchain input |
| `pilot-{slug}:artwork` | Portable outputs, runtime inputs, native sources, OS build, Xcode, Swift and architecture | Complete `.slop` with native preview/icon plus checksum | Yes; sequential per Mac runner |
| `pilot-{slug}:verify` | Restored/generated files, current identities, independent compatibility baseline | Integrity result | **Never** |

The local discovery plugin reads immediate manifest-bearing directories and
enables only the two allowlisted slugs. There are no per-template project files.
All cached artifacts live under `generated/nx-pilot`; they contain no mutable
documents, source dependencies, signing keys, or release acceptance results.
Compilation reuses `buildProject`; artwork uses the existing native screenshot
commands. The custom `TemplateCache` does not participate in the measurements.
Its package validator is reused by the uncached verification step.

Inputs intentionally favor conservative correctness: the full SDK/schema source
and native source trees are included. CLI routing/help is excluded from compiler
inputs. The copied skill and root `tsconfig.v1.json` are explicit inputs, closing
two omissions found in the baseline custom cache. This pilot does not patch that
separate production cache.

Checksums reject damaged output even if Nx decides that files already on disk
need no restoration. Runtime verification also enforces the immutable release
ledger. A failure stops the run; removing only the pilot outputs and rerunning
allows restoration. Native previews can contain time-dependent UI; bitwise
equivalence between independent screenshot captures is not claimed.

## CI and trust

[Nx cache pilot](../.github/workflows/nx-pilot.yml) runs one Linux job, then one
Mac job. It is manually dispatchable once registered on the default branch. A
branch-and-path restricted push trigger bootstraps this unmerged experiment;
rerunning the same GitHub run gives fresh runners at exactly the same commit.
No Nx local cache is uploaded through Actions cache or artifacts. Portable
outputs reach the Mac through Nx Cloud. SwiftPM retains its existing Actions
cache; its restore and helper setup costs remain visible separately.

Nx Cloud is configured by workspace ID. Anonymous and logged-in default access
is read-only, and AI self-healing is disabled. `NX_CLOUD_ACCESS_TOKEN` is an
Actions secret for this trusted workflow. It has no pull-request trigger, checks
the repository/ref, and fails early if the token is absent. Do not expose a write
token to untrusted PRs. No Nx Agents, paid upgrades, or AI fixes are enabled.
See [Nx access tokens](https://nx.dev/docs/kb/access-tokens) and
[cache security](https://nx.dev/docs/kb/cache-security).

The Mac job measures direct execution, fresh-runner remote reuse, local reuse,
and a cloud-disabled uncached run. Each command records elapsed time, actual
executions, platform and tool versions. Cache-hit terminal output alone is not
proof of execution: the journal is outside cached outputs. GitHub step timing
accounts for checkout/install, Swift cache transfer and helper preparation.

## Evaluation

The decision criterion is at least 50% reduction in the warm template path,
including Nx startup and cache transfer, with all correctness scenarios passing.
Two templates do not establish whole-repository or release-gate savings.
Retain separate direct, cold, warm, native setup, transfer, total runner-time and
cloud-usage measurements; never attribute Claude's removal of duplicate release
checks to Nx.

### Results: September 25, 2026

**No-go for a broad migration on this evidence.** Remote caching is correct and
useful, but the measured warm Mac template path improved by **42.4%**, below the
50% criterion. Retain this isolated experiment. A larger corpus benchmark could
test whether more artwork amortizes the overhead; it is a separate follow-up,
not authorization to migrate release acceptance or all templates.

Both attempts of [GitHub run 36159020403](https://github.com/hitSlop/hitslop/actions/runs/36159020403)
passed at commit `9d64ff236b56d33c30eae5b0f012059209a7c8b6`. They used separate
fresh Linux and macOS 15 ARM64 runners, Node 22.23.3 and Bun 1.4.2.
[Raw measurements](evidence/nx-pilot-2026-09-25.json) include execution journals,
local mutation results and GitHub step durations. Full logs are in the run's
four `nx-pilot-*` evidence artifacts.

| Measurement | First attempt | Second attempt |
|---|---:|---:|
| Linux direct portable build, including verification | 3.46s | 4.73s |
| Linux Nx portable command | 6.00s, 0/3 hits | 3.65s, 3/3 remote hits |
| Mac direct full build, including verification | 14.62s | 13.16s |
| Mac Nx remote full build, including verification | 13.83s, 3/5 build hits | 7.58s, 5/5 build hits |
| Mac Nx local warm full build, including verification | 3.72s | 3.10s |
| Mac Nx cloud-disabled, uncached full build | 11.38s | 11.84s |
| Native helper preparation after Swift cache restore | 32.89s | 38.99s |
| Swift cache restore / upload (GitHub step timing) | 33s / 42s | 36s / 0s |
| Linux job duration | 30s | 34s |
| Mac job duration | 183s | 136s |

The Linux Nx command's uncached verification is a separate step (under one
second at GitHub's timing resolution), so its command timing is not a complete
like-for-like speedup claim. The Mac rows include the same integrity checks.
The first Mac run restored all three portable tasks produced on Linux. The
second restored runtime, both compiled packages and both rendered packages,
with only verification entries in the actual execution journal. Thus these
are demonstrated remote hits, not cached terminal logs mistaken for execution.

The second Mac remote command took 4.48s longer than local warm reuse. This is
the observed combined cost of fresh-process setup, cloud access and artifact
transfer; transfer alone was not instrumented and is not claimed to equal that
difference. Total remote time includes all of it. Native setup and Swift cache
transfer remain larger than this two-template build. The two attempts consumed
**1.07 Linux runner-minutes and 5.32 Mac runner-minutes**, summing job start/end
durations (not billed rounding or GitHub multipliers). These are benchmark jobs
containing multiple comparison runs, not estimates for a production workflow.

Local mutation evaluation passed all cases: cold and warm execution, equal
direct/Nx compiled bytes, one-template isolation, CLI entry-point exclusion,
copied skill invalidation and copied bytes, root compiler configuration,
renderer source and reported toolchain changes, missing-output restoration,
corrupt-output rejection, and cloud-disabled forced execution. The local Mac
was concurrently used for other development and reused an existing compatible
helper. Its 26.42s direct / 32.51s cold / 3.02s first-warm measurements are retained
for transparency, but the adoption decision uses the isolated GitHub runners.

The workspace is on **Hobby**. The experiment produced two CI pipeline
executions and six cloud-connected Nx invocations, with zero Nx Agents and
self-healing disabled. The billing dashboard still reports stale September 1
data and zero usage; actual credit consumption is **not settled**, not proven
zero. No paid plan or add-on was enabled.

Maintenance added by the pilot is 298 lines across task adapters, discovery,
verification, measurement and configuration files in `scripts/nx-pilot`, plus
67 lines of Nx configuration and 101 workflow lines (excluding documentation
and lockfile). This is real additional maintenance alongside the existing
cache. Broader adoption should replace redundant cache orchestration rather
than retain both indefinitely. The largest established CI improvements still
come from Claude's preceding reduction of duplicate release work; Nx does not
cache the runtime acceptance suite or eliminate signing/notarization costs.

The baseline snapshot initially picked up an unrelated, untracked import API
test from concurrent work in the main checkout. That test was excluded from the
pilot branch because its implementation was not part of this experiment. The
original checkout and its ongoing import work remain untouched.

Validation: pilot TypeScript check, workflow actionlint, repository hygiene and
`bun run check` passed. The regular Bun suite passed 103 tests and hit one 5-second
timeout in the checkpoint-history test; that test passed on a focused rerun.
The compatibility gate then passed all 55 replay cases and all 51 bundled
template compile/open/reopen checks. No timeout or assertion was weakened.
