import { checkHistory } from "./compatibility-history";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Check } from "typebox/value";
import { RuntimeIdentitySchema } from "../../packages/schema/src/runtime";
import identity from "../../packages/document/src/runtime-identity.json";
import { protocolVersion } from "../../packages/schema/src/bridge";

export const repository = resolve(import.meta.dir, "../..");
export const runtimeDestinations = [
  join(repository, "packages/cli/runtimes"),
  join(repository, "apps/apple/Packages/HitSlopApple/Sources/HitSlopDocument/Resources/runtimes"),
];
export async function digest(root: string, topLevel?: readonly string[]): Promise<string> {
  const hash = createHash("sha256");
  async function visit(prefix: string) {
    const names = prefix === "" && topLevel ? topLevel : await readdir(join(root, prefix));
    for (const name of [...names].sort()) {
      const relative = join(prefix, name),
        path = join(root, relative),
        info = await lstat(path);
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()))
        throw new Error(`Invalid runtime resource: ${path}`);
      hash.update(JSON.stringify([relative, info.isDirectory() ? "directory" : "file"]));
      if (info.isDirectory()) await visit(relative);
      else
        hash.update(
          createHash("sha256")
            .update(await readFile(path))
            .digest(),
        );
    }
  }
  await visit("");
  return hash.digest("hex");
}

/** Match authored template content across machines, independently of previews, guidance and saved state. */
export function templateAppDigest(root: string) {
  return digest(root, ["manifest.json", "state.schema.json", "initial.json", "assets"]);
}
export async function catalog(root: string) {
  const result: Record<string, { identity: typeof identity; sha256: string }> = {};
  for (const name of (await readdir(root)).sort()) {
    if (!/^[1-9][0-9]*$/.test(name)) throw new Error(`Invalid runtime directory: ${name}`);
    const directory = join(root, name);
    if (!(await lstat(directory)).isDirectory())
      throw new Error(`Invalid runtime directory: ${directory}`);
    const value = JSON.parse(await readFile(join(directory, "identity.json"), "utf8"));
    if (!Check(RuntimeIdentitySchema, value) || String(value.runtimeContract) !== name)
      throw new Error(`Invalid runtime identity: ${directory}`);
    for (const file of value.runtimeContract >= 4
      ? ["index.js", "boot.js", "core/hitslop_core_wasm.js", "core/hitslop_core_wasm_bg.wasm"]
      : ["index.js", "boot.js", "headless.js", "loro/index.js", "loro/loro_wasm_bg.wasm"])
      if (!(await lstat(join(directory, file))).isFile())
        throw new Error(`Missing runtime file: ${file}`);
    result[name] = { identity: value, sha256: await digest(directory) };
  }
  if (Object.keys(result).length !== 1) throw new Error(`Expected exactly one runtime: ${root}`);
  return result;
}
export async function verifyCopies(roots: string[]) {
  const values = await Promise.all(roots.map(catalog));
  if (values.some((value) => JSON.stringify(value) !== JSON.stringify(values[0])))
    throw new Error("Runtime contract sets, identities or bytes differ between consumers");
  return values[0]!;
}
export function verifyCurrentRuntime(values: Awaited<ReturnType<typeof catalog>>) {
  const current = values[String(identity.runtimeContract)];
  if (
    !current ||
    Object.entries(identity).some(
      ([key, value]) => current.identity[key as keyof typeof identity] !== value,
    ) ||
    Object.keys(values).some((contract) => Number(contract) > identity.runtimeContract)
  )
    throw new Error("Generated runtime identity is stale; run bun run build");
}
export async function verifyProvenance() {
  const loro = await Bun.file(Bun.resolveSync("loro-crdt/package.json", repository)).json();
  const sdk = await Bun.file(join(repository, "packages/document/package.json")).json();
  const sdkLoro = await Bun.file(
    Bun.resolveSync("loro-crdt/package.json", join(repository, "packages/document")),
  ).json();
  if (
    !Check(RuntimeIdentitySchema, identity) ||
    identity.sdkVersion !== sdk.version ||
    !(await readFile(join(repository, "Cargo.toml"), "utf8")).includes(
      `loro = "=${identity.loroVersion}"`,
    ) ||
    identity.protocolVersion !== protocolVersion
  )
    throw new Error("Runtime provenance differs from the resolved SDK/Loro/bridge");
}
export type Release = {
  runtimeContract: number;
  runtimeRevision: number;
  storageRevision: number;
  loroVersion: string;
  sha256: string;
};
type StorageDecision = {
  runtimeContract: number;
  runtimeRevision: number;
  fromLoroVersion: string;
  toLoroVersion: string;
  storageRevision: number;
  reason: string;
};

/** A changed engine pin requires an explicit compatibility decision, even when the floor stays put. */
export function verifyStorageDecision(
  current: typeof identity,
  published: Release[],
  decisions: StorageDecision[],
) {
  const previous = published
    .filter(
      (r) =>
        r.runtimeContract === current.runtimeContract &&
        r.runtimeRevision < current.runtimeRevision,
    )
    .sort((a, b) => b.runtimeRevision - a.runtimeRevision)[0];
  if (!previous || previous.loroVersion === current.loroVersion) return;
  const matches = decisions.filter(
    (d) =>
      d.runtimeContract === current.runtimeContract &&
      d.runtimeRevision === current.runtimeRevision,
  );
  const decision = matches[0];
  if (
    matches.length !== 1 ||
    !decision ||
    decision.fromLoroVersion !== previous.loroVersion ||
    decision.toLoroVersion !== current.loroVersion ||
    decision.storageRevision !== current.storageRevision ||
    typeof decision.reason !== "string" ||
    !decision.reason.trim()
  )
    throw new Error(
      "Changed Loro pin requires a matching storage-revision decision in runtimes/storage-decisions.json",
    );
}
export async function releases(): Promise<Release[]> {
  const values: Release[] = JSON.parse(
    await readFile(join(repository, "runtimes/releases.json"), "utf8"),
  );
  const seen = new Set<string>();
  for (const value of values) {
    const key = `${value.runtimeContract}-${value.runtimeRevision}`;
    if (
      !Number.isSafeInteger(value.runtimeContract) ||
      value.runtimeContract < 1 ||
      !Number.isSafeInteger(value.runtimeRevision) ||
      value.runtimeRevision < 1 ||
      !Number.isSafeInteger(value.storageRevision) ||
      value.storageRevision < 1 ||
      typeof value.loroVersion !== "string" ||
      !value.loroVersion ||
      !/^[a-f0-9]{64}$/.test(value.sha256) ||
      seen.has(key)
    )
      throw new Error("Invalid runtime release ledger");
    seen.add(key);
  }
  await checkHistory();
  return values;
}
export async function verifyReleasedIdentities(
  values: Awaited<ReturnType<typeof catalog>>,
  published?: Release[],
) {
  published ??= await releases();
  verifyStorageDecision(
    identity,
    published,
    await Bun.file(join(repository, "runtimes/storage-decisions.json")).json(),
  );
  for (const release of published) {
    const installed = values[String(release.runtimeContract)];
    // Approved contract-4 reset: contract 3 remains sealed history, not installed support.
    if (!installed && release.runtimeContract === 3 && values["4"]) continue;
    if (!installed) throw new Error(`Released contract ${release.runtimeContract} was removed`);
    if (installed.identity.runtimeRevision < release.runtimeRevision)
      throw new Error(`Runtime revision moved backwards: ${release.runtimeContract}`);
    if (installed.identity.storageRevision < release.storageRevision)
      throw new Error(`Storage revision moved backwards: ${release.runtimeContract}`);
    if (
      installed.identity.runtimeRevision === release.runtimeRevision &&
      installed.sha256 !== release.sha256
    )
      throw new Error(
        `Released runtime ${release.runtimeContract}/${release.runtimeRevision} changed; increment runtimeRevision`,
      );
  }
}
