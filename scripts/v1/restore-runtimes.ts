/** Restore published readers by immutable identity. Never regenerate historical runtime bytes. */
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import identity from "../../packages/document/src/runtime-identity.json";
import { releases, digest, repository } from "./runtime-artifacts";

async function run(args: string[]) {
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [out, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code) throw new Error(`${args[0]}: ${error}`);
  return out;
}
const missing = [];
for (const release of await releases()) {
  if (
    release.runtimeContract === identity.runtimeContract &&
    release.runtimeRevision === identity.runtimeRevision
  )
    continue;
  const key = `${release.runtimeContract}-${release.runtimeRevision}`;
  const root = join(
    repository,
    "generated/v1/runtime-releases",
    key,
    String(release.runtimeContract),
  );
  if (await Bun.file(join(root, "identity.json")).exists()) {
    if ((await digest(root)) !== release.sha256)
      throw new Error(`Damaged preserved runtime ${key}; refusing to replace it`);
  } else missing.push({ ...release, key });
}
if (missing.length) {
  const repo = process.env.GITHUB_REPOSITORY ?? "hitslop/hitslop";
  const tags = (
    await run(["gh", "api", "--paginate", `repos/${repo}/releases`, "--jq", ".[].tag_name"])
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const release of missing) {
    const temporary = await mkdtemp(join(tmpdir(), "hitslop-release-reader-"));
    try {
      const filename = `runtime-${release.key}.tar.gz`;
      let downloaded = false;
      for (const tag of tags) {
        try {
          await run([
            "gh",
            "release",
            "download",
            tag,
            "--repo",
            repo,
            "--pattern",
            filename,
            "--dir",
            temporary,
          ]);
          downloaded = true;
          break;
        } catch {
          /* A Mac release need not contain every runtime revision. */
        }
      }
      if (!downloaded)
        throw new Error(
          `Missing published ${filename}; restore its immutable release directory before testing`,
        );
      const archive = join(temporary, filename);
      const names = (await run(["tar", "-tzf", archive])).trim().split("\n");
      const entries = (await run(["tar", "-tvzf", archive])).trim().split("\n");
      if (
        names.some(
          (name) => !name.startsWith(release.key + "/") || name.split("/").includes(".."),
        ) ||
        entries.some((entry) => !["-", "d"].includes(entry[0]!))
      )
        throw new Error(`Unsafe runtime archive ${filename}`);
      await run(["tar", "-xzf", archive, "-C", temporary]);
      if (
        (await digest(join(temporary, release.key, String(release.runtimeContract)))) !==
        release.sha256
      )
        throw new Error(`Published runtime checksum mismatch: ${release.key}`);
      const parent = join(repository, "generated/v1/runtime-releases");
      await mkdir(parent, { recursive: true });
      await rename(join(temporary, release.key), join(parent, release.key));
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}
console.log(`Historical runtimes ready (${missing.length} restored)`);
