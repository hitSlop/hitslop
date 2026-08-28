# SQLite Field Notes

An ElementaryUI WebAssembly mini app whose Todo state lives in the ordinary `data.sqlite` file beside its source and compiled UI.

The UI exercises guest-to-host SQLite queries, mutations, transactions, and change notifications. External commits are detected by the host and reload the open WASM view.

`build/app.wasm` is the disposable compiled cartridge. The HTML shell, Elementary browser loader, WASI shim, and storage bridge live once in the Slop host rather than inside this document.
