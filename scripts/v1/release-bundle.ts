/** Retain the exact tested npm artifacts and sealed runtime with a Mac release. */
import { createHash } from "node:crypto";
import { mkdir, readFile, cp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import identity from "../../packages/document/src/runtime-identity.json";
import { repository, releases, runtimeDestinations, verifyCopies, verifyCurrentRuntime } from "./runtime-artifacts";

const project = await readFile(join(repository, "apps/apple/project.yml"), "utf8");
const version = project.match(/MARKETING_VERSION: "([^"]+)"/)?.[1];
const build = project.match(/CURRENT_PROJECT_VERSION: "([^"]+)"/)?.[1];
if (!version || !build || process.env.GITHUB_REF_NAME !== `macos-v${version}`)
  throw new Error("Release tag must match the Apple project marketing version");
const release = (await releases()).find(r => r.runtimeContract === identity.runtimeContract && r.runtimeRevision === identity.runtimeRevision);
if (!release) throw new Error("Seal and commit the validated runtime before tagging a release");
const packageVersions: Record<string, string> = {};
for (const name of ["schema", "document", "cli"]) {
  const metadata = await Bun.file(join(repository, "packages", name, "package.json")).json();
  packageVersions[name] = metadata.version;
  if (name !== "cli" && metadata.version !== identity.sdkVersion)
    throw new Error(`SDK version mismatch: ${name}`);
  for (const dependency of name === "cli" ? ["document", "schema"] : name === "document" ? ["schema"] : [])
    if (metadata.dependencies[`@hitslop/${dependency}`] !== identity.sdkVersion)
      throw new Error(`SDK dependency mismatch: ${name} -> ${dependency}`);
}
if (process.argv.includes("--preflight")) process.exit(0);
const catalog = await verifyCopies(runtimeDestinations);
verifyCurrentRuntime(catalog);
if (catalog[String(identity.runtimeContract)]!.sha256 !== release.sha256)
  throw new Error("Built runtime differs from committed release ledger");
const output = join(repository, "dist/macos");
await mkdir(output, { recursive: true });
const seal = Bun.spawn([process.execPath, "scripts/v1/runtime-release.ts"], { cwd: repository, stdout: "inherit", stderr: "inherit" });
if (await seal.exited) throw new Error("Cannot archive sealed runtime");
const runtimeName = `runtime-${identity.runtimeContract}-${identity.runtimeRevision}.tar.gz`;
const tar = Bun.spawn(["/usr/bin/tar", "-czf", join(output, runtimeName), "-C", join(repository, "generated/v1/runtime-releases"), `${identity.runtimeContract}-${identity.runtimeRevision}`], { stdout: "inherit", stderr: "inherit" });
if (await tar.exited) throw new Error("Cannot pack runtime archive");
const retained = [runtimeName, "runtime-releases.json"];
await cp(join(repository, "runtimes/releases.json"), join(output, "runtime-releases.json"));
for (const name of ["schema", "document", "cli"]) {
  const file = `hitslop-${name}-${packageVersions[name]}.tgz`;
  await cp(join(repository, "generated/v1/npm", file), join(output, file));
  retained.push(file);
}
const git = Bun.spawn(["git", "rev-parse", "HEAD"], { cwd: repository, stdout: "pipe" });
const commit = (await new Response(git.stdout).text()).trim();
if (await git.exited) throw new Error("Cannot identify release commit");
const hashes: Record<string, string> = {};
for (const file of retained) hashes[file] = createHash("sha256").update(await readFile(join(output, file))).digest("hex");
await writeFile(join(output, "release-record.json"), JSON.stringify({ commit, tag: process.env.GITHUB_REF_NAME, macVersion: version, macBuild: build, packageVersions, runtime: { ...identity, sha256: release.sha256 }, artifacts: hashes }, null, 2) + "\n");
hashes["release-record.json"] = createHash("sha256").update(await readFile(join(output, "release-record.json"))).digest("hex");
const sums = await readFile(join(output, "SHA256SUMS"), "utf8");
const prior = sums.split("\n").filter(line => line && !Object.keys(hashes).some(file => line.endsWith(`  ${file}`)));
await writeFile(join(output, "SHA256SUMS"), prior.join("\n") + "\n" + Object.entries(hashes).map(([file, hash]) => `${hash}  ${file}\n`).join(""));
console.log(`Retained tested artifacts for ${commit}`);
