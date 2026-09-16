import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { api, artifacts, repository, secret, token, until } from "../../Prototypes/native-loro-relay/tests/client";
import { verifyRelay } from "../../Prototypes/native-loro-relay/tests/relay";
import { verifyE2E } from "./e2e";

const root = join(repository, "Prototypes/native-loro-relay"), endpointFile = join(repository, ".hitslop/native-loro/hosted.json");
await mkdir(artifacts, { recursive: true });
async function wrangler(args: string[], input?: string) {
  const process = Bun.spawn(["bun", "x", "wrangler", ...args], { cwd: root, stdin: input ? "pipe" : "ignore", stdout: "pipe", stderr: "pipe" });
  if (input) { process.stdin.write(input); process.stdin.end(); }
  const [out, error, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
  // Only CLI status text is recorded; secret values are supplied on stdin.
  await writeFile(join(artifacts, `cloudflare-${args[0]}.log`), out + error);
  if (code !== 0) throw new Error(`Cloudflare ${args[0]} failed (${code}); see results-v2/cloudflare-${args[0]}.log`);
  return out;
}
if (process.argv.includes("--deploy")) {
  const output = await wrangler(["deploy"]);
  const endpoint = output.match(/https:\/\/hitslop-native-loro-spike\.[a-zA-Z0-9-]+\.workers\.dev/)?.[0];
  if (!endpoint) throw new Error("Worker deployed but its endpoint was not found in the deployment output");
  await wrangler(["secret", "put", "TOKEN_KEY"], await secret());
  // A successful secret upload can precede propagation to the serving version.
  const probe = crypto.randomUUID(), credential = token(await secret(), probe, "probe", true);
  await until(async () => {
    try {
      await api(endpoint, probe, credential, "POST", "", { documentId: probe, schema: "a".repeat(64), checkpoint: "cHJvYmU=", version: "probe" }); return true;
    } catch (error) { if (String(error).includes("401:")) return false; throw error; }
  }, "signing secret propagation", 45000);
  await api(endpoint, probe, credential, "DELETE");
  await writeFile(endpointFile, JSON.stringify({ endpoint }, null, 2));
  console.log(`Isolated test Worker: ${endpoint}`);
}
const { endpoint } = JSON.parse(await readFile(endpointFile, "utf8"));
await verifyRelay(endpoint);
await verifyE2E(endpoint, process.argv.includes("--open-pair"));
console.log("Hosted relay and native tests completed.");
