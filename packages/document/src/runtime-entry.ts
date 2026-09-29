// Engine-free native page runtime. Browser development loads the Rust WASM binding on demand.
export { boot, createContext } from "./boot";
export { default as runtimeIdentity } from "./runtime-identity.json";
