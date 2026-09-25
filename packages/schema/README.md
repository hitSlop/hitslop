# @hitslop/schema

TypeBox definitions and validation for hitSlop manifests, bridge envelopes, and runtime contracts.

Socket types are exported from `@hitslop/schema/socket`; bridge requests and method-specific
successful replies come from `@hitslop/schema/bridge`. `bun run schema:generate` emits the
Swift socket models and bridge method enum alongside the existing native validators.
Validate untrusted Foundation dictionaries before mapping them into generated types.
Operation contents and document state remain opaque to native code.

```sh
bun add @hitslop/schema@1.1.0
```

See the [authoring guide](https://github.com/hitSlop/hitslop/blob/master/docs/guides/authoring.md) and [release guide](https://github.com/hitSlop/hitslop/blob/master/docs/guides/releasing.md).

Part of the hitSlop SDK 1.1.0, runtime contract 1 / revision 2. MIT licensed.
