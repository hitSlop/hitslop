import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { dataSchemaFromJSON } from "@hitslop/schema";

/** Fresh evaluation avoids stale transitive imports. Schemas must be deterministic.
 * timeoutMs is an internal test seam, not a CLI option.
 */
export async function loadDataSchema(path: string, timeoutMs = 10_000): Promise<Record<string, unknown>> {
  const absolute = resolve(path);
  const loader = Bun.resolveSync("./schema-loader", dirname(fileURLToPath(import.meta.url)));
  let receive!: (message: unknown) => void;
  const result = new Promise<unknown>(resolve => { receive = resolve; });
  const child = Bun.spawn([process.execPath, loader, absolute], {
    stdin: "ignore", stdout: process.stderr.fd, stderr: process.stderr.fd,
    ipc: message => receive(message),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const message = await Promise.race([
      result,
      child.exited.then(code => { throw new Error(`Loader exited without a result (status ${code})`); }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Schema evaluation timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    if (!message || typeof message !== "object" || !("ok" in message)) throw new Error("Invalid loader response");
    if (message.ok === false && "error" in message && typeof message.error === "string") throw new Error(message.error);
    if (message.ok !== true || !("schema" in message)) throw new Error("Invalid loader response");
    return dataSchemaFromJSON(message.schema);
  } catch (error) {
    throw new Error(`Could not evaluate schema.ts (${absolute}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  } finally {
    clearTimeout(timer);
    child.disconnect();
    // Schema modules can leave timers running or ignore SIGTERM. Always reap them.
    child.kill("SIGKILL");
    await child.exited;
  }
}
