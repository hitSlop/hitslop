import { lstat, mkdir, readFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
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

async function gitFiles(): Promise<string[]> {
  const candidates = (await command(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], root, true))
    .split("\0")
    .filter(Boolean);
  const existing = await Promise.all(candidates.map(async (path) => await pathExists(resolve(root, path)) ? path : null));
  return existing.filter((path): path is string => path !== null);
}

function assertTrackedHygiene(files: string[]): void {
  const failures: string[] = [];
  for (const path of files) {
    const name = path.split("/").at(-1) ?? path;
    const lower = name.toLowerCase();
    const example = lower.endsWith(".example");
    if ((lower.startsWith(".env") || lower.startsWith(".dev.vars")) && !example) failures.push(path);
    if (/^authkey_.*\.p8$/i.test(name) || /\.(p8|p12|key|jks|keystore|mobileprovision)$/i.test(name)) failures.push(path);
    if (name === "Icon\r" || /\.sqlite-(wal|shm)$/i.test(name) || /\.sqlite-journal$/i.test(name)) failures.push(path);
  }
  if (failures.length) throw new Error(`Forbidden tracked artifacts:\n${[...new Set(failures)].map((path) => `  - ${path}`).join("\n")}`);
}

function assertNoGeneratedSource(files: string[]): void {
  const generated = files.filter((path) => /^packages\/[^/]+\/src\//.test(path) && /\.(?:d\.ts|js)$/.test(path));
  if (generated.length) throw new Error(`Generated JavaScript/declarations found beside package source:\n${generated.map((path) => `  - ${path}`).join("\n")}`);
}

async function checkIgnored(path: string, shouldIgnore: boolean): Promise<void> {
  const child = Bun.spawn(["git", "check-ignore", "--no-index", "-q", path], { cwd: root });
  const ignored = await child.exited === 0;
  if (ignored !== shouldIgnore) throw new Error(`${path} should ${shouldIgnore ? "" : "not "}be ignored`);
}

async function assertTextHygiene(files: string[]): Promise<void> {
  const extensions = new Set(["", ".css", ".html", ".js", ".json", ".jsx", ".md", ".sh", ".slop", ".svelte", ".swift", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml"]);
  const privatePaths: string[] = [];
  const privateKeys: string[] = [];
  for (const path of files) {
    if (!extensions.has(extname(path)) && ![".gitignore", "SLOPS.todo"].includes(basename(path))) continue;
    const text = await Bun.file(resolve(root, path)).text();
    if (/\/Users\/|\/Volumes\//.test(text)) privatePaths.push(path);
    if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/.test(text)) privateKeys.push(path);
  }
  if (privatePaths.length) throw new Error(`Private absolute paths found in release files:\n${privatePaths.map((path) => `  - ${path}`).join("\n")}`);
  if (privateKeys.length) throw new Error(`Private key material found in release files:\n${privateKeys.map((path) => `  - ${path}`).join("\n")}`);
}

async function pathExists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function assertDocumentationLinks(files: string[]): Promise<void> {
  const markdown = files.filter((path) => path.endsWith(".md"));
  const failures: string[] = [];
  for (const path of markdown) {
    const text = await readFile(resolve(root, path), "utf8");
    const destinations = [
      ...[...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)].map((match) => match[1]!),
      ...[...text.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]!),
    ];
    for (const raw of destinations) {
      if (/^(?:https?:|mailto:|#)/.test(raw)) continue;
      const withoutAnchor = raw.split("#", 1)[0]!;
      if (!withoutAnchor) continue;
      const target = resolve(root, dirname(path), decodeURIComponent(withoutAnchor));
      if (!await pathExists(target)) failures.push(`${path} -> ${raw}`);
    }
  }
  if (failures.length) throw new Error(`Broken local documentation links:\n${failures.map((item) => `  - ${item}`).join("\n")}`);
}

async function assertPriorArt(files: string[]): Promise<void> {
  const roots = new Set<string>();
  for (const path of files) {
    const match = path.match(/^(archive\/templates\/[^/]+|Prototypes\/[^/]+)\//);
    if (match && !match[1]!.endsWith("/README.md") && !match[1]!.endsWith("/ROADMAP.md")) roots.add(match[1]!);
  }
  const roadmap = await readFile(resolve(root, "SLOPS.todo"), "utf8");
  const missing = [...roots].filter((path) => !roadmap.includes(`\`${path}\``));
  if (missing.length) throw new Error(`Prior-art directories missing from SLOPS.todo:\n${missing.map((path) => `  - ${path}`).join("\n")}`);
}

async function assertSkill(path: string): Promise<void> {
  const text = await readFile(resolve(root, path), "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${path} has no YAML frontmatter`);
  const keys = [...match[1]!.matchAll(/^([a-zA-Z0-9_-]+):/gm)].map((item) => item[1]);
  if (keys.join(",") !== "name,description") throw new Error(`${path} frontmatter must contain only name and description`);
}

async function main(): Promise<void> {
  const files = await gitFiles();
  assertTrackedHygiene(files);
  assertNoGeneratedSource(files);
  await assertTextHygiene(files);
  await Promise.all([
    checkIgnored("AuthKey_FAKE123.p8", true),
    checkIgnored(".env.production", true),
    checkIgnored("apps/firebase/.env.local", true),
    checkIgnored("apps/firebase/firebase-debug.log", true),
    checkIgnored("_vibe/reference.png", true),
    checkIgnored("archive/templates/unlisted-private/manifest.json", true),
    assertDocumentationLinks(files),
    assertPriorArt(files),
    assertSkill(".agents/skills/hitslop-authoring/SKILL.md"),
    assertSkill(".agents/skills/hitslop-design/SKILL.md"),
  ]);
  process.stdout.write("✓ repository hygiene, documentation, and skills\n");

  await command(["bun", "run", "release:npm:check"]);
  assertNoGeneratedSource(await gitFiles());
  await command(["bun", "run", "test:emulator"], join(root, "apps/firebase"));

  if (process.platform === "darwin" && process.env.HITSLOP_SKIP_SWIFT !== "1") {
    const moduleCache = resolve(root, ".hitslop/release-cache/clang");
    await mkdir(moduleCache, { recursive: true });
    const swiftEnv = { CLANG_MODULE_CACHE_PATH: moduleCache, SWIFTPM_MODULECACHE_OVERRIDE: moduleCache };
    await command(["swift", "test", "--package-path", "apps/apple/Packages/HitSlopApple"], root, false, swiftEnv);
    await command(["swift", "build", "--package-path", "apps/apple/Packages/HitSlopApple", "--product", "hitslop-native"], root, false, swiftEnv);
  } else {
    process.stdout.write("↷ Swift checks run on macOS CI (or set HITSLOP_SKIP_SWIFT=0 on macOS)\n");
  }

  process.stdout.write("\n✓ the hitSlop first-launch foundation is ready for release\n");
}

await main();
