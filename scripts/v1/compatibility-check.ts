import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Check } from "typebox/value";
import { RuntimeRequirementsSchema } from "../../packages/schema/src/runtime";
import { catalog, digest, releases, repository, runtimeDestinations } from "./runtime-artifacts";

const installed = await catalog(runtimeDestinations[0]!);
const root = join(repository, "tests/compatibility");
const covered = new Set<number>();
for (const name of await readdir(root)) {
  const fixture = Bun.file(join(root, name, "fixture.json"));
  if (!(await fixture.exists())) continue;
  const record = await fixture.json();
  const document = join(root, name, "document");
  if ((await digest(document)) !== record.sha256)
    throw new Error(`Preserved fixture changed: ${name}`);
  const requirements = await Bun.file(join(document, "assets/runtime.json")).json();
  if (
    !Check(RuntimeRequirementsSchema, requirements) ||
    requirements.runtimeContract !== record.runtimeContract ||
    requirements.minRuntimeRevision !== record.runtimeRevision
  )
    throw new Error(`Invalid fixture identity: ${name}`);
  const runtime = installed[String(record.runtimeContract)];
  if (!runtime || runtime.identity.runtimeRevision < record.runtimeRevision)
    throw new Error(`Unsupported fixture: ${name}`);
  covered.add(record.runtimeContract);
}
for (const contract of Object.keys(installed))
  if (!covered.has(Number(contract)))
    throw new Error(`Missing conformance fixture for contract ${contract}`);
for (const release of await releases()) {
  const current = installed[String(release.runtimeContract)];
  if (current?.identity.runtimeRevision === release.runtimeRevision) continue;
  const historical = join(
    repository,
    "generated/v1/runtime-releases",
    `${release.runtimeContract}-${release.runtimeRevision}`,
    String(release.runtimeContract),
  );
  if ((await digest(historical)) !== release.sha256)
    throw new Error(
      `Restore the immutable runtime release ${release.runtimeContract}-${release.runtimeRevision} for compatibility testing`,
    );
}
for (const pattern of [
  "examples/slops/{quick-checklist,small-expenses}/dist/*.slop/assets/runtime.json",
  "generated/v1/templates/**/*.slop/assets/runtime.json",
]) {
  // Discover packages through their manifests, so missing requirements cannot evade validation.
  for (const manifest of new Bun.Glob(
    pattern.replace("assets/runtime.json", "manifest.json"),
  ).scanSync(repository)) {
    const requirements = await Bun.file(
      join(repository, manifest.replace("manifest.json", "assets/runtime.json")),
    ).json();
    if (!Check(RuntimeRequirementsSchema, requirements))
      throw new Error(`Invalid template requirements: ${manifest}`);
    const runtime = installed[String(requirements.runtimeContract)];
    if (!runtime || runtime.identity.runtimeRevision < requirements.minRuntimeRevision)
      throw new Error(`Unsupported template: ${manifest}`);
  }
}
