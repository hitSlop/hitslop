import { documentRuntime } from "./runtime-provider.js";

Object.defineProperty(window, "__hitslopDocumentRuntime", { value: documentRuntime, configurable: false, writable: false });
