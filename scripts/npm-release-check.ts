import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const packageNames = ["schema", "runtime", "svelte", "react", "cli"] as const;

async function command(argv: string[], cwd = root, quiet = false, extraEnv: Record<string, string> = {}): Promise<string> {
  const label = argv.join(" ");
  process.stdout.write(`→ ${label}\n`);
  const child = Bun.spawn(argv, {
    cwd,
    stdout: quiet ? "pipe" : "inherit",
    stderr: quiet ? "pipe" : "inherit",
    env: { ...process.env, ...extraEnv },
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    quiet ? new Response(child.stdout).text() : Promise.resolve(""),
    quiet ? new Response(child.stderr).text() : Promise.resolve(""),
  ]);
  if (exitCode !== 0) {
    if (stdout) process.stderr.write(stdout);
    if (stderr) process.stderr.write(stderr);
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }
  return stdout;
}

async function main(): Promise<void> {
  await command(["bun", "run", "schema:generate"]);
  await command(["bun", "run", "schema:check"]);

  for (const name of packageNames) await command(["bun", "run", "check"], join(root, "packages", name));
  for (const name of packageNames) await command(["bun", "run", "test"], join(root, "packages", name));
  for (const name of packageNames) await command(["bun", "run", "build"], join(root, "packages", name));

  // The API Worker is the untrusted package-ingress boundary, so its validator
  // is part of the npm foundation even though the app itself is not published.
  await command(["bun", "run", "check"], join(root, "apps/api"));
  await command(["bun", "run", "test"], join(root, "apps/api"));

  // Pack and install the artifacts outside the monorepo. This catches missing
  // files, bad bin metadata, and workspace dependencies that a source-level
  // smoke test can accidentally satisfy from the checkout.
  const temporaryRoot = process.env.RUNNER_TEMP ?? (process.platform === "win32" ? tmpdir() : "/tmp");
  const temporary = await mkdtemp(join(temporaryRoot, "hitslop-npm-release-"));
  try {
    const installTemporary = join(temporary, "tmp");
    const installCache = join(temporary, "bun-cache");
    await mkdir(installTemporary);
    await mkdir(installCache);
    const installEnv = { TMPDIR: installTemporary, BUN_INSTALL_CACHE_DIR: installCache };
    const tarballs = join(temporary, "tarballs");
    await mkdir(tarballs);
    const packageReferences: Record<(typeof packageNames)[number], string> = {} as Record<(typeof packageNames)[number], string>;
    for (const name of packageNames) {
      const tarball = join(tarballs, `${name}.tgz`);
      await command(["bun", "pm", "pack", "--filename", tarball, "--quiet"], join(root, "packages", name), true);
      packageReferences[name] = `file:${tarball}`;
      process.stdout.write(`✓ packed @hitslop/${name}\n`);
    }

    const harness = join(temporary, "harness");
    await mkdir(harness);
    await writeFile(join(harness, "package.json"), `${JSON.stringify({
      name: "hitslop-release-harness",
      private: true,
      dependencies: {
        "@hitslop/schema": packageReferences.schema,
        "@hitslop/runtime": packageReferences.runtime,
        "@hitslop/svelte": packageReferences.svelte,
        "@hitslop/react": packageReferences.react,
        "@hitslop/cli": packageReferences.cli,
        react: "^19.0.0",
        svelte: "^5.0.0",
        zod: "^4.0.0",
      },
      overrides: {
        "@hitslop/schema": packageReferences.schema,
        "@hitslop/runtime": packageReferences.runtime,
      },
    }, null, 2)}\n`);
    await command(["bun", "install"], harness, false, installEnv);

    const app = join(temporary, "release-counter");
    const installedCLI = join(harness, "node_modules", ".bin", "slop");
    await command([installedCLI, "init", app, "--yes", "--title", "Release Counter"], harness);

    // Substitute only the unpublished hitSlop packages. Everything else is
    // resolved normally, exactly as it will be after the first npm release.
    const appPackagePath = join(app, "package.json");
    const appPackage = JSON.parse(await readFile(appPackagePath, "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      overrides?: Record<string, string>;
    };
    appPackage.dependencies["@hitslop/runtime"] = packageReferences.runtime;
    appPackage.dependencies["@hitslop/svelte"] = packageReferences.svelte;
    appPackage.devDependencies["@hitslop/cli"] = packageReferences.cli;
    appPackage.devDependencies["@hitslop/schema"] = packageReferences.schema;
    appPackage.overrides = {
      "@hitslop/schema": packageReferences.schema,
      "@hitslop/runtime": packageReferences.runtime,
    };
    await writeFile(appPackagePath, `${JSON.stringify(appPackage, null, 2)}\n`);

    await command(["bun", "install"], app, false, installEnv);
    await command(["bun", "run", "validate"], app);
    await command(["bun", "run", "build"], app);
    const manifest = JSON.parse(await readFile(join(app, "manifest.json"), "utf8")) as { slug: string };
    await command([join(app, "node_modules", ".bin", "slop"), "validate", join(app, "dist", `${manifest.slug}.slop`)], app);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  process.stdout.write("\n✓ npm tarballs and the clean-room authoring scaffold are ready\n");
}

await main();
