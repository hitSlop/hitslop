import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  api,
  repository,
  secret,
  token,
  until,
} from "../../Prototypes/native-loro-relay/tests/client";
import { verifyRelay } from "../../Prototypes/native-loro-relay/tests/relay";
import { verifyIncrementalRelay } from "../../Prototypes/native-loro-relay/tests/incremental";
import { verifyIncrementalE2E } from "./incremental-e2e";

const args = process.argv.slice(2),
  output = join(repository, ".hitslop/native-loro/results-v4");
const packagePath = join(repository, "apps/apple/Packages/HitSlopApple");
process.env.HITSLOP_SPIKE_EXECUTABLE = join(
  packagePath,
  ".build/release/hitslop-loro-spike",
);
await mkdir(output, { recursive: true });
if (args.includes("--deploy") && !args.includes("--hosted"))
  throw new Error("--deploy requires --hosted");
if (args.includes("--hosted-only") && !args.includes("--hosted"))
  throw new Error("--hosted-only requires --hosted");
async function run(command: string[], name: string) {
  console.log(`Running ${name}`);
  const child = Bun.spawn(command, {
    cwd: repository,
    stdout: Bun.file(join(output, name + ".log")),
    stderr: "inherit",
  });
  if ((await child.exited) !== 0)
    throw new Error(`${name} failed; see results-v4/${name}.log`);
}
async function deploy() {
  async function wrangler(args: string[], input?: string) {
    const child = Bun.spawn(["bun", "x", "wrangler", ...args], {
      cwd: join(repository, "Prototypes/native-loro-relay"),
      stdin: input ? "pipe" : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    if (input) {
      child.stdin!.write(input);
      child.stdin!.end();
    }
    const [out, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    await writeFile(join(output, `cloudflare-${args[0]}.log`), out + error);
    if (code !== 0) throw new Error(`Cloudflare ${args[0]} failed (${code})`);
    return out;
  }
  const out = await wrangler(["deploy"]),
    endpoint = out.match(
      /https:\/\/hitslop-native-loro-spike\.[a-zA-Z0-9-]+\.workers\.dev/,
    )?.[0];
  if (!endpoint) throw new Error("Isolated Worker endpoint missing");
  await wrangler(["secret", "put", "TOKEN_KEY"], await secret());
  const room = crypto.randomUUID(),
    owner = token(await secret(), room, "probe", true);
  await until(
    async () => {
      try {
        await api(endpoint, room, owner, "POST", "", {
          protocol: 2,
          documentId: room,
          schema: "a".repeat(64),
          checkpoint: "cHJvYmU=",
          version: "probe",
        });
        return true;
      } catch (error) {
        if (String(error).includes("401:")) return false;
        throw error;
      }
    },
    "test signing secret propagation",
    45000,
  );
  await api(endpoint, room, owner, "DELETE");
  await writeFile(
    join(repository, ".hitslop/native-loro/hosted.json"),
    JSON.stringify({ endpoint }, null, 2),
  );
  return endpoint;
}
const result: any = {
  experiment: "native-loro-incremental-v4",
  recordedAt: new Date().toISOString(),
  loro: "1.13.3",
  protocol: 2,
  confirmation: "durable",
  passed: false,
};
try {
  if (!args.includes("--skip-build")) {
    await run(["bun", "scripts/native-loro/prepare.ts"], "prepare");
    await run(
      [
        "swift",
        "build",
        "--package-path",
        packagePath,
        "-c",
        "release",
        "--product",
        "hitslop-loro-spike",
      ],
      "build",
    );
    await run(
      [
        "swift",
        "test",
        "--package-path",
        packagePath,
        "--filter",
        "HitSlopLoroSpikeTests",
        "--no-parallel",
      ],
      "swift-tests",
    );
    await run(
      [
        "bun",
        "node_modules/typescript/bin/tsc",
        "-p",
        "Prototypes/native-loro-relay/tsconfig.json",
      ],
      "relay-types",
    );
    await run(
      [
        "bun",
        "node_modules/typescript/bin/tsc",
        "-p",
        "scripts/native-loro/tsconfig.json",
      ],
      "harness-types",
    );
    result.buildAndUnitTests = true;
  }
  if (!args.includes("--hosted-only")) {
    const relay = Bun.spawn(["bun", "scripts/native-loro/relay-local.ts"], {
      cwd: repository,
      stdout: Bun.file(join(output, "relay-server.log")),
      stderr: "inherit",
    });
    try {
      await until(
        async () => {
          if (relay.exitCode !== null) throw new Error("Relay exited");
          try {
            return (await fetch("http://127.0.0.1:8791/health")).status === 404;
          } catch {
            return false;
          }
        },
        "local relay readiness",
        30000,
      );
      const endpoint = "http://127.0.0.1:8791";
      result.local = {
        legacy: await verifyRelay(endpoint),
        protocol: await verifyIncrementalRelay(endpoint),
        native: await verifyIncrementalE2E(endpoint),
      };
    } finally {
      relay.kill();
      await relay.exited;
    }
  }
  if (args.includes("--hosted")) {
    const endpoint = args.includes("--deploy")
      ? await deploy()
      : JSON.parse(
          await readFile(
            join(repository, ".hitslop/native-loro/hosted.json"),
            "utf8",
          ),
        ).endpoint;
    result.hosted = {
      legacy: await verifyRelay(endpoint),
      protocol: await verifyIncrementalRelay(endpoint),
      native: await verifyIncrementalE2E(endpoint),
    };
  }
  if (!result.local && !result.hosted) throw new Error("No gates selected");
  result.passed = [result.local, result.hosted]
    .filter(Boolean)
    .every(
      (run) =>
        run.native.passed &&
        [...run.legacy, ...run.protocol].every((c) => c.passed),
    );
  if (!result.passed) throw new Error("Incremental verification failed");
} catch (error) {
  result.error = String(error);
  throw error;
} finally {
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(`Incremental report: ${output}/results.json`);
}
