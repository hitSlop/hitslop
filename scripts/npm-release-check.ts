import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const packageNames = ["schema", "runtime", "svelte", "cli"] as const;

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
  for (const name of packageNames) {
    const packagePath = join(root, "packages", name, "package.json");
    const packageManifest = JSON.parse(await readFile(packagePath, "utf8")) as Record<string, unknown>;
    for (const group of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
      const dependencies = packageManifest[group];
      if (!dependencies || typeof dependencies !== "object") continue;
      for (const [dependency, reference] of Object.entries(dependencies as Record<string, unknown>)) {
        if (typeof reference === "string" && reference.startsWith("workspace:")) {
          throw new Error(`${packagePath}: ${group}.${dependency} must use a publishable semver range, not ${reference}`);
        }
      }
    }
  }

  await command(["bun", "run", "schema:generate"]);
  await command(["bun", "run", "schema:check"]);

  // Build dependency packages before TypeScript resolves workspace exports from
  // their published dist paths. A developer checkout may already have these
  // files, but CI intentionally starts without them.
  for (const name of packageNames) await command(["bun", "run", "build"], join(root, "packages", name));
  for (const name of packageNames) await command(["bun", "run", "check"], join(root, "packages", name));
  for (const name of packageNames) await command(["bun", "run", "test"], join(root, "packages", name));

  // Firebase Functions is the untrusted package-ingress boundary, so its validator
  // is part of the npm foundation even though the app itself is not published.
  await command(["bun", "run", "check"], join(root, "apps/firebase"));
  await command(["bun", "run", "test"], join(root, "apps/firebase"));

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
        "@hitslop/cli": packageReferences.cli,
        svelte: "^5.0.0",
        typebox: "^1.3.26",
      },
      overrides: {
        "@hitslop/schema": packageReferences.schema,
        "@hitslop/runtime": packageReferences.runtime,
      },
    }, null, 2)}\n`);
    await command(["bun", "install"], harness, false, installEnv);

    // Quick Checklist is the platform pilot; the legacy init scaffold is deferred.
    // Compile the actual IconTarget/ExportTarget consumer from packed dependencies.
    const app = join(temporary, "release-checklist");
    await mkdir(app);
    for (const name of ["src", "manifest.json", "index.html", "schema.ts", "theme.ts", "vite.config.ts"]) {
      await cp(join(root, "examples/slops/quick-checklist", name), join(app, name), { recursive: true });
    }
    const examplePackage = JSON.parse(await readFile(join(root, "examples/slops/package.json"), "utf8")) as {
      dependencies: Record<string, string>; devDependencies: Record<string, string>;
    };
    const appPackage = {
      name: "hitslop-capture-consumer", private: true, type: "module",
      scripts: { check: "svelte-check --tsgo --tsconfig tsconfig.json", build: "slop build .", validate: "slop validate ." },
      dependencies: examplePackage.dependencies,
      devDependencies: examplePackage.devDependencies,
      overrides: Object.fromEntries(packageNames.map(name => [`@hitslop/${name}`, packageReferences[name]])),
    };
    for (const dependencies of [appPackage.dependencies, appPackage.devDependencies]) {
      for (const name of Object.keys(dependencies)) {
        if (name in appPackage.overrides) dependencies[name] = appPackage.overrides[name]!;
      }
    }
    await writeFile(join(app, "package.json"), JSON.stringify(appPackage, null, 2) + "\n");
    await writeFile(join(app, "tsconfig.json"), JSON.stringify({
      compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true, skipLibCheck: true, allowJs: true, checkJs: true, verbatimModuleSyntax: true, noEmit: true },
      include: ["src/**/*", "schema.ts", "theme.ts"],
    }, null, 2) + "\n");

    await command(["bun", "install"], app, false, installEnv);
    await command(["bun", "run", "check"], app);
    await command(["bun", "run", "validate"], app);
    await command(["bun", "run", "build"], app);
    const manifest = JSON.parse(await readFile(join(app, "manifest.json"), "utf8")) as { slug: string };
    await command([join(app, "node_modules", ".bin", "slop"), "validate", join(app, "dist", `${manifest.slug}.slop`)], app);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  process.stdout.write("\n✓ npm tarballs and the clean-room Svelte capture consumer are ready\n");
}

await main();
