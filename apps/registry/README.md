# @hitslop/registry

Convex owns searchable catalog metadata, anonymous install/favorite counters,
immutable release records, screenshots, and `.slop` artifacts. Public source
archives live on Code.Storage and are referenced by URL.

The repository commits this directory and Convex's generated API files. Real
deployment identifiers and secrets belong in `.env.local`.

Do not run setup until the maintainer is ready to select the Longtail Labs
Convex project. From this directory, the setup command is:

```sh
bunx convex dev
```
