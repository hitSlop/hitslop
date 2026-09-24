import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseManifest } from "../../packages/schema/src/manifest";
import { fromDescriptor, validate } from "@hitslop/document";
import identity from "../../packages/document/src/runtime-identity.json";
import { digest } from "./runtime-artifacts";

const format = 1;
const ignored = new Set([
  "node_modules",
  "dist",
  ".git",
  ".build",
  ".swiftpm",
  ".DS_Store",
  ".svelte-kit",
  ".svelte-check",
  ".vite",
  ".crust",
]);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Content and path based; timestamps and checkout locations never enter the key. */
export async function fingerprint(root: string, paths: string[], context: unknown = null) {
  const files: [string, string][] = [];
  async function visit(path: string, inputRoot = false) {
    const info = await lstat(path);
    if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()))
      throw new Error(`Unsupported template input: ${path}`);
    if (info.isDirectory()) {
      files.push([relative(root, path), "directory"]);
      for (const name of (await readdir(path)).sort())
        if (!inputRoot || !ignored.has(name)) await visit(join(path, name));
    } else
      files.push([
        relative(root, path),
        createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      ]);
  }
  for (const path of [...paths].sort()) await visit(join(root, path), true);
  return hash(JSON.stringify({ format, context, files }));
}

export async function sharedTemplateFingerprint(repository: string, sources: string[]) {
  const native = "apps/apple/Packages/HitSlopApple";
  const paths = [
    "package.json",
    "bun.lock",
    "tsconfig.v1.json",
    "scripts/v1",
    "packages/cli/src",
    "packages/cli/skills",
    "packages/cli/package.json",
    "packages/document/src",
    "packages/document/package.json",
    "packages/schema/src",
    "packages/schema/package.json",
    "packages/cli/runtimes",
    `${native}/Package.swift`,
    `${native}/Package.resolved`,
    ...["HitSlopCore", "HitSlopWasm", "HitSlopRuntime", "HitSlopHost", "HitSlopNativeCLI"].map(
      (name) => `${native}/Sources/${name}`,
    ),
  ];
  // Include shared authoring configs and future shared directories, but not other templates.
  for (const name of await readdir(join(repository, "examples/slops"))) {
    const path = join("examples/slops", name);
    if (
      !ignored.has(name) &&
      !["archive", "bundled.json"].includes(name) &&
      !sources.includes(path)
    )
      paths.push(path);
  }
  async function version(command: string[]) {
    const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
    const [out, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code) throw new Error(`Cannot fingerprint ${command[0]}: ${error}`);
    return out.trim();
  }
  const toolchain = await Promise.all([
    version(["/usr/bin/sw_vers", "-buildVersion"]),
    version(["xcodebuild", "-version"]),
    version(["swift", "--version"]),
  ]);
  return fingerprint(repository, paths, {
    toolchain,
    arch: process.arch,
    bun: Bun.version,
    debug: process.env.HITSLOP_DEBUG_BUILD === "1",
  });
}

/** Cheap package checks shared by cache reads and signed-app verification. */
export async function validateTemplate(path: string, slug: string) {
  const root = await lstat(path);
  if (!root.isDirectory() || root.isSymbolicLink())
    throw new Error(`Invalid template directory: ${slug}`);
  const allowed = new Set([
    "manifest.json",
    "app.html",
    "assets",
    "state.schema.json",
    "initial.json",
    "QuickLook",
    ".agents",
  ]);
  for (const name of await readdir(path))
    if (!allowed.has(name)) throw new Error(`Unexpected template content: ${slug}/${name}`);
  const checksum = await digest(path); // Rejects symlinks and special files throughout the package.
  const manifest = parseManifest(JSON.parse(await readFile(join(path, "manifest.json"), "utf8")));
  if (manifest.slug !== slug) throw new Error(`Template slug mismatch: ${slug}`);
  const descriptor = fromDescriptor(
    JSON.parse(await readFile(join(path, "state.schema.json"), "utf8")),
  );
  validate(
    descriptor.descriptor.root,
    JSON.parse(await readFile(join(path, "initial.json"), "utf8")),
  );
  const requirement = JSON.parse(await readFile(join(path, "assets/runtime.json"), "utf8"));
  if (
    requirement.runtimeContract !== identity.runtimeContract ||
    requirement.minRuntimeRevision !== identity.runtimeRevision ||
    requirement.sdkVersion !== identity.sdkVersion
  )
    throw new Error(`Template runtime mismatch: ${slug}`);
  if (!(await readFile(join(path, "app.html"))).length) throw new Error(`Empty template: ${slug}`);
  for (const name of ["Preview.png", "Icon.png"]) {
    const png = await readFile(join(path, "QuickLook", name)).catch((error) => {
      if (name === "Icon.png" && error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!png) continue; // The CLI's --if-present icon capture deliberately permits no custom icon.
    if (
      png.length < 33 ||
      png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      png.toString("ascii", 12, 16) !== "IHDR" ||
      !png.readUInt32BE(16) ||
      !png.readUInt32BE(20)
    )
      throw new Error(`Invalid template artwork: ${slug}/${name}`);
  }
  return checksum;
}

/** Only workflows opt into this cache. A miss always falls back to the ordinary builder. */
export class TemplateCache {
  constructor(
    readonly directory: string,
    readonly shared: string,
  ) {}

  async build(source: string, slug: string, destination: string, build: () => Promise<unknown>) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid cache slug: ${slug}`);
    const key = await fingerprint(source, ["."], this.shared);
    const entry = join(this.directory, slug);
    try {
      const metadata = JSON.parse(await readFile(join(entry, "entry.json"), "utf8"));
      if (
        metadata.format === format &&
        metadata.key === key &&
        metadata.checksum === (await validateTemplate(join(entry, "package.slop"), slug))
      ) {
        await cp(join(entry, "package.slop"), destination, {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
        return "hit" as const;
      }
    } catch {
      // Missing, corrupt, or obsolete cache entries are disposable, never authoritative.
    }
    await build();
    const checksum = await validateTemplate(destination, slug);
    await mkdir(this.directory, { recursive: true });
    const stage = join(this.directory, `${slug}.building-${crypto.randomUUID()}`);
    try {
      await mkdir(stage);
      await cp(destination, join(stage, "package.slop"), { recursive: true });
      await writeFile(join(stage, "entry.json"), JSON.stringify({ format, key, checksum }));
      await rm(entry, { recursive: true, force: true });
      await rename(stage, entry);
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
    return "built" as const;
  }

  async prune(slugs: string[]) {
    await mkdir(this.directory, { recursive: true });
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || slugs.includes(entry.name)) continue;
      const path = join(this.directory, entry.name);
      const metadata = await readFile(join(path, "entry.json"), "utf8").then(
        (text) => {
          try {
            return JSON.parse(text);
          } catch {
            return undefined;
          }
        },
        () => undefined,
      );
      // Only remove our own entries, even if a caller accidentally selects a shared directory.
      if (
        metadata?.format === format &&
        typeof metadata.key === "string" &&
        typeof metadata.checksum === "string"
      )
        await rm(path, { recursive: true, force: true });
    }
  }
}
