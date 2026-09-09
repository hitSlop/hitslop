import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
      const entries = (await command(["tar", "-tzf", tarball], root, true)).trim().split("\n");
      const allowed = new Set(["package.json", "README.md", "LICENSE", "dist", ...(name === "cli" ? ["templates"] : []), ...(name === "schema" ? ["generated"] : [])]);
      for (const entry of entries) {
        const path = entry.replace(/^package\//, "").replace(/\/$/, "");
        if (!path) continue;
        if (!allowed.has(path.split("/")[0]!)) throw new Error(`Unexpected packed file: ${name}/${path}`);
      }
      if (name === "cli" && !entries.includes("package/dist/module-loader.js")) throw new Error("CLI tarball is missing its module loader");
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


    // Exercise the packed CLI's actual init output outside the workspace.
    const starter = join(temporary, "release-counter");
    await command([join(harness, "node_modules/.bin/slop"), "init", starter, "--yes", "--author-name", "Release Test"], harness);
    const starterPath = join(starter, "package.json");
    const starterPackage = JSON.parse(await readFile(starterPath, "utf8"));
    starterPackage.overrides = Object.fromEntries(packageNames.map(name => [`@hitslop/${name}`, packageReferences[name]]));
    for (const group of ["dependencies", "devDependencies"]) {
      for (const name of packageNames) {
        const id = `@hitslop/${name}`;
        if (starterPackage[group]?.[id]) starterPackage[group][id] = packageReferences[name];
      }
    }
    await writeFile(starterPath, JSON.stringify(starterPackage, null, 2) + "\n");
    await command(["bun", "install"], starter, false, installEnv);
    // Compile inference and rejection checks against the actual emitted starter schema.
    await cp(join(root, "packages/cli/tests/fixtures/counter.typecheck.txt"), join(starter, "src/counter.typecheck.ts"));
    await command(["bun", "run", "check"], starter);
    await rm(join(starter, "src/counter.typecheck.ts"));
    await command(["bun", "run", "validate"], starter);
    await command(["bun", "run", "build"], starter);
    await command([join(starter, "node_modules/.bin/slop"), "validate", join(starter, "dist/release-counter.slop")], starter);

    if (process.env.HITSLOP_NATIVE_CLI) {
      if (process.platform !== "darwin") throw new Error("Native release checks require macOS");
      const builtStarter = join(starter, "dist/release-counter.slop");
      const slop = join(starter, "node_modules/.bin/slop");
      await command(["swift", "test", "--package-path", "apps/apple/Packages/HitSlopApple", "--filter", "compiledCounterStarterPersistsAndReopens"], root, false, { HITSLOP_STARTER_PACKAGE: builtStarter });
      for (const target of ["preview", "icon"]) {
        const output = join(temporary, `counter-${target}.png`);
        await command([slop, "screenshot", builtStarter, "--target", target, "--output", output], starter);
        const png = await readFile(output);
        if (png.readUInt32BE(0) !== 0x89504e47) throw new Error("Invalid native PNG");
        if (target === "icon" && (png.readUInt32BE(16) !== 512 || png.readUInt32BE(20) !== 512)) throw new Error("Icon must be 512×512");
      }
      for (const format of ["png", "pdf"]) {
        const output = join(temporary, `counter-export.${format}`);
        await command([slop, "export", builtStarter, "--format", format, "--output", output], starter);
        const bytes = await readFile(output);
        if (format === "pdf" ? bytes.subarray(0, 5).toString() !== "%PDF-" : bytes.readUInt32BE(0) !== 0x89504e47) throw new Error(`Invalid ${format} export`);
      }
      if ((await readdir(builtStarter)).includes("stores")) throw new Error("Capture mutated the starter template");
    }

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
    if (process.env.HITSLOP_KEEP_RELEASE_TEMP === "1") process.stdout.write(`Release diagnostics retained: ${temporary}\n`);
    else await rm(temporary, { recursive: true, force: true });
  }

  process.stdout.write("\n✓ npm tarballs, fresh init, and Quick Checklist are ready\n");
}

await main();
