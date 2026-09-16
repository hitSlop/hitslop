import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { secret, repository } from "../../Prototypes/native-loro-relay/tests/client";

const root = resolve(repository, "Prototypes/native-loro-relay");
await mkdir(root, { recursive: true });
await writeFile(resolve(root, ".dev.vars"), `TOKEN_KEY=${await secret()}\n`, { mode: 0o600 });
const server = Bun.spawn(["bun", "x", "wrangler", "dev", "--port", "8791", "--persist-to", resolve(repository, ".hitslop/native-loro/relay-storage")], { cwd: root, stdout: "inherit", stderr: "inherit" });
process.on("SIGTERM", () => server.kill()); process.on("SIGINT", () => server.kill());
process.exitCode = await server.exited;
