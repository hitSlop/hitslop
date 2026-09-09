# Codex Pet

A transparent desktop companion for standard Codex pet packages. Bubu is bundled as the clearly licensed starter; drop a `.zip` or `.codex-pet.zip` containing `pet.json` and `spritesheet.webp` to replace it. Imported packages are validated before the original ZIP is atomically stored as named document media.

The renderer supports v1 `1536x1872` and v2 `1536x2288` atlases with 192x208 cells. It varies ambient actions by local time, pauses while hidden, and respects reduced motion. Drag the visible pet to move the native hitSlop window.

```sh
bun slop dev examples/slops/codex-pet
bun slop dev examples/slops/codex-pet --native
bun slop build examples/slops/codex-pet
```

Bubu was created by Guo Beining and is distributed under the MIT License: <https://github.com/gbn666/codex-pets-bubuyier>. The bundled asset's notice is preserved in `assets/BUBU-LICENSE.txt` and ships with the runtime package.
