import { checkHistory } from "./compatibility-history";
/** Explicit release sealing. Ordinary builds never rewrite baselines. */
import { cp, mkdir, writeFile, mkdtemp, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  repository,
  runtimeDestinations,
  verifyCopies,
  verifyCurrentRuntime,
  verifyProvenance,
  verifyReleasedIdentities,
  releases,
  digest,
} from "./runtime-artifacts";
import identity from "../../packages/document/src/runtime-identity.json";
await checkHistory();
await verifyProvenance();
const values = await verifyCopies(runtimeDestinations);
verifyCurrentRuntime(values);
await verifyReleasedIdentities(values);
const published = await releases();
const name = `${identity.runtimeContract}-${identity.runtimeRevision}`;
const source = join(runtimeDestinations[0]!, String(identity.runtimeContract));
const output = join(
  repository,
  "generated/v1/runtime-releases",
  name,
  String(identity.runtimeContract),
);
const hash = values[String(identity.runtimeContract)]!.sha256;
if (await Bun.file(join(output, "identity.json")).exists()) {
  if ((await digest(output)) !== hash)
    throw new Error(`Refusing to replace release artifact ${name}`);
} else {
  const parent = join(repository, "generated/v1/runtime-releases");
  await mkdir(parent, { recursive: true });
  const stage = await mkdtemp(join(parent, ".building-"));
  try {
    await cp(source, join(stage, String(identity.runtimeContract)), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    await rename(stage, join(parent, name));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
if (
  !published.some(
    (r) =>
      r.runtimeContract === identity.runtimeContract &&
      r.runtimeRevision === identity.runtimeRevision,
  )
) {
  published.push({
    runtimeContract: identity.runtimeContract,
    runtimeRevision: identity.runtimeRevision,
    sha256: hash,
  });
  await writeFile(
    join(repository, "runtimes/releases.json"),
    JSON.stringify(published, null, 2) + "\n",
  );
}
console.log(
  `Sealed ${name}. Preserve generated/v1/runtime-releases/${name}/ with the published app artifacts.`,
);
