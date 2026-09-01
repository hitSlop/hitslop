# Contributing to hitSlop

Thanks for helping make tiny software feel personal again.

## Start here

1. Install [Bun](https://bun.sh/) and Xcode if you are changing Apple code.
2. Run `bun install` from the repository root.
3. Read [the repository guide](docs/repository.md) and the nearest `AGENTS.md`.
4. Make a focused change with tests or a reproducible manual check.
5. Run `bun run release:check` before opening a pull request.

For a new mini app, start in `examples/slops/` and follow
[the authoring guide](docs/authoring.md). Do not commit generated `app.html`,
dependencies, caches, seed databases, or editable stylesheets inside an
authored template.

## Pull requests

- Explain the user-visible problem and the chosen approach.
- Include screenshots for visual changes.
- Note any manifest, storage, compatibility, or migration impact.
- Keep generated schema output in sync by running `bun run schema:generate`
  after Zod schema changes.
- Do not include secrets, signing keys, local documents, or private paths.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
