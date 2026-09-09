import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The embedding script uses a private build directory and deletes it before
// returning. Rendering here therefore cannot find SwiftPM's build-path fallback.
const root = resolve(import.meta.dir, "..");
const temporary = await mkdtemp(join(tmpdir(), "hitslop-embedded-helper-"));
async function run(args: string[]) {
  const env = { ...process.env };
  delete env.HITSLOP_NATIVE_SCRATCH;
  const child = Bun.spawn(args, { cwd: root, env, stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Failed: ${args.join(" ")}`);
}
try {
  const app = join(temporary, "hitSlop.app");
  await mkdir(app);
  await run(["sh", "scripts/embed-hitslop-native.sh", app]);
  const document = join(temporary, "smoke.slop");
  await mkdir(document);
  await cp(join(root, "examples/slops/quick-checklist/manifest.json"), join(document, "manifest.json"));
  await writeFile(join(document, "app.html"), `<!doctype html><html><body><h1>Embedded helper</h1><script>
    window.slop.json.open({ count: 1 }).then(() => window.slop.ready());
  </script></body></html>`);
  const output = join(temporary, "preview.png");
  await run([join(app, "Contents/Helpers/hitslop-native"), "screenshot", document, "--output", output]);
  const bytes = await readFile(output);
  if (bytes.length < 8 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Embedded helper did not render a PNG");
  process.stdout.write("✓ embedded Release helper renders without SwiftPM build resources\n");
} finally {
  if (process.env.HITSLOP_KEEP_RELEASE_TEMP === "1") process.stdout.write(`Helper diagnostics retained: ${temporary}\n`);
  else await rm(temporary, { recursive: true, force: true });
}
