# Deferred hosted client and account integration

This snapshot preserves the Apple hosted catalog, OpenAPI/Registry client, Firebase
Auth/App Check, and sharing archive code removed for the local release. It is outside
all Swift targets and test gates. Mixed files are retained as integration references;
the active client owns their local behavior. Do not copy whole files back over it.

`Sources/HitSlopCore/SlopArchive.swift` contains the extracted archive utilities.
Archive tests and their fixture helpers are preserved in `Tests/HitSlopCoreTests`.
The Runtime fixtures are historical command-engine inputs, not v1 contracts.

`packages/api/src/generate.ts` writes its Apple contract here. `packages/api` and
`apps/cloudflare` remain separate, excluded backend scaffolding. Neither is a v1
runtime or release gate. Their retired schema/room dependencies need redesign before
reuse; future sharing must exchange Loro updates, never JSON room seeds.

Restoring hosted features requires an explicit product decision, current contracts,
and new integration tests. The preserved Package.swift records former dependencies;
it is reference material, not a second buildable Apple package.

The removed archive error case was `SlopPackageError.unsafeArchive(String)` with
message `Unsafe archive entry: <path>`. Reintroduce archive-specific errors only
when archive import becomes an active product requirement.
