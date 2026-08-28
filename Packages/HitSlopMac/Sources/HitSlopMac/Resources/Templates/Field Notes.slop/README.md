# Field Notes

An ElementaryUI WebAssembly mini app whose editable source and data live beside it.

- `source/` contains the three AI- and human-editable app files.
- `build/app.wasm` is the disposable compiled cartridge.
- `data.json` is the authoritative Todo state used by this sample.

The HTML shell, Elementary browser loader, WASI shim, and storage bridge are owned by the Slop host and are not duplicated here. Edit `data.json` while the document is open and the UI will reload it. Writes from the UI are atomically committed back to that same file. After changing Swift source, use the host's Build button or `slop-host build` command to replace `build/app.wasm`.
