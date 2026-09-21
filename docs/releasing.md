# Releasing

The active contract is `hitslop-v1`, SQLite format 1, and the pinned SDK/Loro release shared by the app and native CLI. There is no legacy-format migration. Shipped v1 documents retain supported runtime contracts; see [versioning](versioning.md). Current workspace packages are private; historical npm/publishing gates are not release instructions for v1.

## Local gate

Use the Bun version pinned in root `package.json` and Xcode on macOS:

```sh
bun run build
bun run check
bun run test
bun run swift:test
bun run test:storage
bun run test:native-helper
bun run apple:build
bun run test:native-crash
```

`bun run test:local` combines the local checks. Inspect failures and generated changes before release. Only Quick Checklist and Small Expenses are active examples. Build order is runtime generation, Swift helper compilation, then template preview/icon capture.

## Native packaging

`scripts/embed-hitslop-native.sh` embeds the executable and Core, Runtime, and Wasm resource bundles beside it. Verify the relocated helper can edit and render with its bundled resources, without Node/Bun or a checkout runtime. Test both live socket commands and closed engine-only commands. `HITSLOP_NATIVE_CLI` selects an explicit helper when testing TypeScript forwarding or template capture.

```sh
scripts/install-macos-release.sh
scripts/package-macos-release.sh
```

The desktop release is Apple silicon, macOS 14 or newer. App version/build values live in `apps/apple/project.yml`. Packaging signs the native helper and resource bundles alongside the app. Developer ID, notarization, App Store Connect, provisioning, and Sparkle private keys remain outside Git. Release from the exact tested commit; publishing hosted services and npm packages remains deferred.

Before publication, run `bun scripts/v1/runtime-release.ts` after compatibility checks. Commit the release hash ledger and preserve the emitted `generated/v1/runtime-releases/<contract>-<revision>/` directory with the published app artifacts. Never overwrite a published revision. Restore historical release directories before compatibility tests after a revision bump.
