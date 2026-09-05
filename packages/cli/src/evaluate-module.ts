import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/** Fresh evaluation avoids stale transitive imports. Author modules must be deterministic.
 * timeoutMs is an internal test seam, not a CLI option.
 */
export async function evaluateModule(path: string, kind: "schema" | "theme", timeoutMs = 10_000): Promise<unknown> {
  const absolute = resolve(path);
  const loader = Bun.resolveSync("./module-loader", dirname(fileURLToPath(import.meta.url)));
  let receive!: (message: unknown) => void;
  const result = new Promise<unknown>(resolve => { receive = resolve; });
  const child = Bun.spawn([process.execPath, loader, absolute, kind], {
    stdin: "ignore", stdout: process.stderr.fd, stderr: process.stderr.fd,
    ipc: message => receive(message),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const message = await Promise.race([
      result,
      child.exited.then(code => { throw new Error(`Loader exited without a result (status ${code})`); }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${kind} evaluation timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    if (!message || typeof message !== "object" || !("ok" in message)) throw new Error("Invalid loader response");
    if (message.ok === false && "error" in message && typeof message.error === "string") throw new Error(message.error);
    if (message.ok !== true || !("value" in message)) throw new Error("Invalid loader response");
    return message.value;
  } catch (error) {
    throw new Error(`Could not evaluate ${kind}.ts (${absolute}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  } finally {
    clearTimeout(timer);
    child.disconnect();
    // Author modules can leave timers running or ignore SIGTERM. Always reap them.
    child.kill("SIGKILL");
    await child.exited;
  }
}
