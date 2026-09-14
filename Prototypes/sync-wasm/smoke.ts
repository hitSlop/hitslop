import { errors } from "../../packages/runtime/src/host-errors";
import { LoroDoc } from "loro-crdt/base64";
import { digest, utf8 } from "../../packages/sync/src/encoding";
const hash = await digest(utf8("abc"));
if (hash !== "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") throw new Error("SHA-256 unavailable");
const result = document.querySelector("#result")!;
try {
  const original = new LoroDoc();
  original.getMap("data").set("title", "Loro ready");
  const restored = new LoroDoc();
  restored.import(original.export({ mode: "snapshot" }));
  if (restored.getMap("data").get("title") !== "Loro ready") throw new Error("Snapshot did not round-trip");
  result.textContent = "Loro mutation and snapshot round-trip passed";
  (window as Window & { slop?: { ready?(): void } }).slop?.ready?.();
} catch (error) { result.textContent = String(error); }

const button = document.querySelector<HTMLButtonElement>("#host-error")!;
button.onclick = () => errors.report({ id: "smoke", message: "Example operation failed", details: "This deliberate error verifies host-owned recovery UI.", action: { label: "Retry example", run: async () => { result.textContent = "Host recovery action passed"; } } });
