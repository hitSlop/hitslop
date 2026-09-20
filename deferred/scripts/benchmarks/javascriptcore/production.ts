import { copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fixtures, identity, lease, workloads } from "./fixtures.ts";
import { envelopeSchema } from "../../../packages/schema/src/document.ts";
import { buildSlop } from "../../../packages/cli/src/project.ts";
import { canonical } from "../../../packages/schema/src/document-protocol.ts";

const checklist = process.argv.includes("--checklist");
const root = resolve(import.meta.dir, "../../..");
const output = resolve(
  root,
  ".hitslop/spikes/javascriptcore",
  `production-${new Date().toISOString().replaceAll(":", "-")}`,
);
await mkdir(output, { recursive: true });
async function command(args: string[]) {
  const child = Bun.spawn(args, { cwd: root, stdout: "pipe", stderr: "inherit" });
  const result = await new Response(child.stdout).text();
  if (await child.exited) {
    console.error(result);
    throw new Error(`Failed: ${args.join(" ")}`);
  }
  return result.trim();
}
console.log(`Production evidence: ${output}`);
await command([
  "swift",
  "build",
  "--package-path",
  "apps/apple/Packages/HitSlopApple",
  "-c",
  "release",
  "--product",
  "hitslop-javascriptcore-spike",
]);
const bin = await command([
  "swift",
  "build",
  "--package-path",
  "apps/apple/Packages/HitSlopApple",
  "-c",
  "release",
  "--show-bin-path",
]);
const binary = resolve(output, "production-engine-check");
await copyFile(resolve(bin, "hitslop-javascriptcore-spike"), binary);
for (const module of ["HitSlopCore", "HitSlopRuntime", "HitSlopDocumentEngine"])
  await cp(
    resolve(bin, `HitSlopApple_${module}.bundle`),
    resolve(output, `HitSlopApple_${module}.bundle`),
    { recursive: true },
  );
await command(["codesign", "--force", "--sign", "-", "--options", "runtime", binary]);
await command(["codesign", "--verify", "--strict", binary]);
const env = {
  ...Bun.env,
  JSC_useJIT: "false",
  HITSLOP_ENGINE_BENCHMARK: "1",
  WRANGLER_SEND_METRICS: "false",
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
};
const native = Bun.spawn([binary, "production-rpc"], {
  cwd: root,
  env,
  stdin: "pipe",
  stdout: "pipe",
  stderr: "inherit",
});
const lines = (async function* () {
  let pending = "";
  const decoder = new TextDecoder();
  for await (const chunk of native.stdout) {
    pending += decoder.decode(chunk, { stream: true });
    let index: number;
    while ((index = pending.indexOf("\n")) >= 0) {
      yield pending.slice(0, index);
      pending = pending.slice(index + 1);
    }
  }
})();
async function nativeCall(method: string, args: string[]) {
  native.stdin.write(JSON.stringify({ method, args }) + "\n");
  await native.stdin.flush();
  const line = await lines.next();
  if (line.done) throw new Error("Production native engine exited");
  const reply = JSON.parse(line.value);
  if (reply.error) throw new Error(reply.error);
  return JSON.parse(reply.value);
}
const reservation = Bun.serve({ port: 0, fetch: () => new Response() });
const port = reservation.port!;
reservation.stop(true);
const config = resolve(output, "wrangler.json");
await writeFile(
  config,
  JSON.stringify({
    name: "hitslop-production-engine-check",
    main: resolve(import.meta.dir, "worker.ts"),
    compatibility_date: "2026-09-15",
  }),
);
const worker = Bun.spawn(
  [
    "node",
    resolve(root, "apps/cloudflare/node_modules/wrangler/bin/wrangler.js"),
    "dev",
    "--config",
    config,
    "--local",
    "--port",
    String(port),
  ],
  {
    cwd: root,
    env,
    stdout: Bun.file(resolve(output, "workerd.log")),
    stderr: Bun.file(resolve(output, "workerd-errors.log")),
  },
);
async function workerCall(method: string, args: string[]) {
  const response = await fetch(`http://127.0.0.1:${port}`, {
    method: "POST",
    body: JSON.stringify({ production: true, method, args }),
  });
  const reply = (await response.json()) as any;
  if (reply.error) throw new Error(reply.error);
  return reply.value;
}
const checks: string[] = [];
try {
  for (let i = 0; ; i++) {
    try {
      await workerCall("canonical", ["null"]);
      break;
    } catch {
      if (i === 200 || worker.exitCode !== null) throw new Error("workerd did not start");
      await Bun.sleep(100);
    }
  }
  for (const f of fixtures) {
    if (f.expected.schemaError) {
      for (const call of [nativeCall, workerCall]) {
        let rejected = false;
        try {
          await call("configure", [JSON.stringify(f.schema)]);
        } catch {
          rejected = true;
        }
        if (!rejected) throw new Error(`Unsupported schema accepted: ${f.name}`);
      }
      checks.push(f.name);
      continue;
    }
    const request = JSON.stringify({
      ...identity,
      requestId: f.name,
      leaseId: lease.id,
      ...f.command,
    });
    const state = JSON.stringify({
      snapshot: { ...identity, revision: f.state?.snapshotRevision ?? 0, data: f.data },
      lease,
      undo: f.state?.undo,
    });
    const results = [];
    for (const call of [nativeCall, workerCall]) {
      await call("configure", [JSON.stringify(f.schema)]);
      const inspected = await call("request", [request]);
      const digest = new Bun.CryptoHasher("sha256").update(inspected.canonical).digest("hex");
      const result = await call("evaluate", [state, request, digest, String(f.now ?? 0)]);
      results.push({
        request: inspected.canonical,
        result: JSON.parse(result.result.json),
        snapshot: result.snapshot ? JSON.parse(result.snapshot.json) : null,
        receipt: result.receipt ?? null,
      });
      if (
        f.expected.code
          ? result.result.error?.code !== f.expected.code
          : canonical(JSON.parse(result.snapshot.data)) !== canonical(f.expected.data)
      )
        throw new Error(`Wrong result: ${f.name}`);
    }
    if (canonical(results[0]) !== canonical(results[1]))
      throw new Error(`JSC/V8 mismatch: ${f.name}`);
    checks.push(f.name);
  }
} finally {
  native.stdin.end();
  native.kill();
  worker.kill();
  await Promise.all([native.exited, worker.exited]);
}
await Bun.write(
  resolve(output, "parity.json"),
  JSON.stringify({ checks, passed: checks.length }, null, 2),
);
const pilot = checklist
  ? await buildSlop(resolve(root, "examples/slops/quick-checklist"))
  : undefined;
for (const [name, workload] of [
  ["small", workloads()[0]!],
  ["large", workloads().at(-1)!],
] as const) {
  const directory = resolve(output, `${name}.slop`);
  if (pilot) {
    await cp(pilot.directory, directory, { recursive: true });
    const data = {
      title: "Benchmark checklist",
      tasks: Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        text: `Task ${i + 1}`,
        done: false,
        archived: false,
      })),
    };
    await Bun.write(resolve(directory, "assets/initial.json"), JSON.stringify(data));
    const html = await Bun.file(resolve(directory, "app.html")).text();
    await Bun.write(
      resolve(directory, "app.html"),
      html + "<span id='count' hidden></span><script>globalThis.benchRevision=0</script>",
    );
    continue;
  }
  await mkdir(resolve(directory, "assets"), { recursive: true });
  await Bun.write(
    resolve(directory, "manifest.json"),
    JSON.stringify({
      $schema: "https://api.hitslop.com/schemas/v1/manifest.schema.json",
      slug: "engine-benchmark",
      title: "Engine benchmark",
      description: "Local production-path benchmark",
      categories: ["utilities"],
      author: { name: "Tests" },
      presentation: { width: 320, height: 240 },
    }),
  );
  await Bun.write(
    resolve(directory, "data.schema.json"),
    JSON.stringify(envelopeSchema(JSON.parse(workload.schemaJSON))),
  );
  await Bun.write(
    resolve(directory, "assets/initial.json"),
    JSON.stringify(JSON.parse(workload.snapshotJSON).data),
  );
  await Bun.write(
    resolve(directory, "app.html"),
    "<!doctype html><body><span id='count'></span><script>globalThis.benchRevision=0;slop.ready()</script>",
  );
}
const resourceBundle = resolve(output, "HitSlopApple_HitSlopDocumentEngine.bundle");
const contentsResource = Bun.file(resolve(resourceBundle, "Contents/Resources/document-engine.js"));
const executedBundle = (await contentsResource.exists())
  ? contentsResource
  : Bun.file(resolve(resourceBundle, "document-engine.js"));
await Bun.write(
  resolve(output, "environment.json"),
  JSON.stringify(
    {
      bun: Bun.version,
      os: await command(["sw_vers"]),
      hardware: await command(["sysctl", "-n", "machdep.cpu.brand_string", "hw.memsize"]),
      signing: "ad-hoc hardened runtime; no entitlements; JSC_useJIT=false",
      bundleSHA256: new Bun.CryptoHasher("sha256")
        .update(await executedBundle.arrayBuffer())
        .digest("hex"),
      workloadRows: checklist ? [100, 100] : [14000, 100],
      scope: `Production native session, generated WebKit bridge, SQLite and JSC; ${checklist ? "compiled Quick Checklist with 100 tasks and an additional minimal DOM subscriber" : "minimal DOM subscriber with synthetic 14k tasks"}. Timing ends at subscriber layout; it does not await Svelte paint. Host RSS/CPU exclude WebContent processes.`,
    },
    null,
    2,
  ),
);
const benchmark = Bun.spawn(
  [binary, "production-benchmark", output, resolve(output, "benchmark.json")],
  { cwd: root, env, stdout: "inherit", stderr: "inherit" },
);
if (await benchmark.exited) throw new Error(`Production benchmark failed: ${output}`);
await Bun.write(
  resolve(root, ".hitslop/spikes/javascriptcore/production-latest.txt"),
  output + "\n",
);
console.log(`Passed ${checks.length} production JSC/V8 fixtures. Evidence: ${output}`);
