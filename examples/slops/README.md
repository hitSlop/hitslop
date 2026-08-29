# Maintained examples

These are the maintained, publishable examples. Each directory is an authored
project containing `manifest.json`, `source/`, seed stores, and an optional
document-local `style.css`. The archived templates are in `archive/templates/`.

From the repository root:

```sh
bun install
bun slop dev examples/slops/invoice
bun slop build examples/slops/invoice
```

The native Swift resources and registry releases are generated. Never edit a
runtime `.slop` package directly.
