import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dir, "..");
const expectedBun = (await Bun.file(join(root, "package.json")).json()).packageManager.replace(
  "bun@",
  "",
);
if (Bun.version !== expectedBun)
  throw new Error(`Use Bun ${expectedBun}; found ${Bun.version}. No checks have run.`);
if (process.platform !== "darwin")
  throw new Error("The complete local gate requires macOS and Xcode.");
const output = join(root, ".hitslop/local-tests", new Date().toISOString().replaceAll(":", "-"));
await mkdir(join(output, "visual"), { recursive: true });
const results: {
  name: string;
  status: "passed" | "failed";
  seconds: number;
  log: string;
  skipped: string[];
}[] = [];
const env: Record<string, string | undefined> = {
  ...process.env,
  HITSLOP_NATIVE_SYNC: "1",
  HITSLOP_LOCAL_TESTS: "1",
  HITSLOP_NATIVE_CONFIGURATION: "debug",
  HITSLOP_KEEP_RELEASE_TEMP: "1",
  HITSLOP_PILOT_OUTPUT: join(output, "visual"),
  WRANGLER_LOG_PATH: join(output, "wrangler.log"),
  WRANGLER_SEND_METRICS: "false",
};
delete env.HITSLOP_SKIP_SWIFT;
delete env.HITSLOP_NATIVE_CLI;

async function run(name: string, args: string[], required: string[] = []): Promise<string> {
  const start = performance.now();
  const log = join(output, `${name}.log`);
  process.stdout.write(`→ ${name}\n`);
  const child = Bun.spawn(args, { cwd: root, env, stdout: "pipe", stderr: "pipe" });
  const chunks: string[] = [];
  async function drain(stream: ReadableStream<Uint8Array>, destination: NodeJS.WriteStream) {
    const decoder = new TextDecoder();
    for await (const bytes of stream) {
      const value = decoder.decode(bytes, { stream: true });
      chunks.push(value);
      destination.write(value);
    }
    chunks.push(decoder.decode());
  }
  const [exitCode] = await Promise.all([
    child.exited,
    drain(child.stdout, process.stdout),
    drain(child.stderr, process.stderr),
  ]);
  const text = chunks.join("");
  await writeFile(log, text);
  const missing = required.filter((test) => !text.includes(`Test ${test}() passed`));
  const passed = exitCode === 0 && missing.length === 0;
  results.push({
    name,
    status: passed ? "passed" : "failed",
    seconds: (performance.now() - start) / 1000,
    log,
    skipped: text.split("\n").filter((line) => /\bskipped\b|\(skip\)/i.test(line)),
  });
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      { bun: Bun.version, platform: process.platform, architecture: process.arch, results },
      null,
      2,
    ),
  );
  if (!passed)
    throw new Error(
      `${name} failed${missing.length ? `; required tests did not pass: ${missing.join(", ")}` : ` (exit ${exitCode})`}. See ${log}`,
    );
  return text;
}

try {
  await run("toolchain", ["swift", "--version"]);
  await run("hygiene", ["bun", "scripts/release-check.ts", "--hygiene-only"]);
  await run("format", ["bun", "run", "format:check"]);
  await run("generated", ["bun", "run", "schema:check"]);
  await run("native-debug", [
    "swift",
    "build",
    "--package-path",
    "apps/apple/Packages/HitSlopApple",
    "--configuration",
    "debug",
    "--product",
    "hitslop-native",
  ]);
  const bin = Bun.spawnSync(
    [
      "swift",
      "build",
      "--package-path",
      "apps/apple/Packages/HitSlopApple",
      "--configuration",
      "debug",
      "--show-bin-path",
    ],
    { cwd: root },
  );
  if (bin.exitCode !== 0) throw new Error("Cannot locate Debug native helper");
  Object.assign(env, { HITSLOP_NATIVE_CLI: join(bin.stdout.toString().trim(), "hitslop-native") });
  await run(
    "packages-and-local-sharing",
    ["bun", "run", "release:npm:check"],
    ["nativeCommandsRecoverThroughRealCloudflareRoom", "compiledCounterStarterPersistsAndReopens"],
  );
  await run("examples", ["bun", "run", "examples:check"]);
  await run(
    "native-and-checklist",
    ["bun", "scripts/native-runtime-check.ts"],
    [
      "slopWrapperReportsFailuresAndResetsWithoutReopeningStore",
      "guestErrorsReachHostWithoutBreakingReadiness",
      "presentationFixturesExportWithoutNativeMaskAndRenderSquareIcons",
      "presentationStageFillsNestedRootsAndRestoresAfterCapture",
      "ringMaskLetsClicksFallThroughItsTransparentHole",
      "quickChecklistCompiledSveltePersistsAndReopens",
      "quickChecklistKeyboardCompositionReorderRemoveUndoAndEmptyState",
      "compiledChecklistExportsSelectedViewLongContentAndDynamicIcon",
      "acknowledgedEditSurvivesProcessTermination",
    ],
  );
  await run("relocated-debug-helper", ["bun", "scripts/native-helper-check.ts"]);
  await run("landing-check", ["bun", "run", "--cwd", "apps/landing", "check"]);
  await run("landing-build", ["bun", "run", "--cwd", "apps/landing", "build"]);
  await run("final-drift", ["bun", "run", "schema:check"]);
  process.stdout.write(`\n✓ Local automated gate passed. Review captures in ${output}.\n`);
} finally {
  process.stdout.write(`Local test evidence: ${output}\n`);
}
