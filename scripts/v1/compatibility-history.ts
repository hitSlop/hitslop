import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repository = resolve(import.meta.dir, "../..");
async function git(root: string, args: string[]) {
  const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const [out, error, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code) throw new Error(`git ${args[0]}: ${error.trim()}`);
  return out.trim();
}

/** CI supplies the PR base / previous push, never the candidate commit itself. */
export async function checkHistory(root = repository, baseline = process.env.HITSLOP_COMPAT_BASE) {
  if (!baseline) {
    // Prefer the previous shipped release. HEAD also protects uncommitted local edits
    // before the first release; CI must provide its independently selected base.
    if (process.env.CI) throw new Error("CI requires HITSLOP_COMPAT_BASE");
    baseline = await git(root, [
      "describe",
      "--tags",
      "--match",
      "macos-v*",
      "--abbrev=0",
      "HEAD^",
    ]).catch(() => "HEAD");
  }
  const commit = await git(root, ["rev-parse", "--verify", `${baseline}^{commit}`]);
  const entries = (
    await git(root, [
      "ls-tree",
      "-r",
      "-z",
      commit,
      "tests/compatibility",
      "runtimes/releases.json",
    ])
  )
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [metadata, path] = line.split("\t");
      return { path: path!, hash: metadata!.split(" ")[2]! };
    });
  if (entries.some((entry) => entry.path === "runtimes/releases.json")) {
    const previous = JSON.parse(await git(root, ["show", `${commit}:runtimes/releases.json`]));
    const current = JSON.parse(await readFile(join(root, "runtimes/releases.json"), "utf8"));
    for (const entry of previous) {
      // The documented pre-shipment baseline was never a released runtime.
      if (
        entry.runtimeContract === 1 &&
        entry.runtimeRevision === 1 &&
        entry.sha256 === "1b9504af7d8b39866b507884e124104398dc5dd373cf028d1b2d1c9dfc1e5dcd"
      )
        continue;
      if (
        !current.some(
          (value: typeof entry) =>
            value.runtimeContract === entry.runtimeContract &&
            value.runtimeRevision === entry.runtimeRevision &&
            value.sha256 === entry.sha256,
        )
      )
        throw new Error(`Published runtime record changed relative to ${commit}`);
    }
  }
  const sealed = entries.filter(({ path }) =>
    /^tests\/compatibility\/[^/]+\/(document\/|fixture\.json$|expected\.json$|scenario\.json$)/.test(
      path,
    ),
  );
  for (let start = 0; start < sealed.length; start += 128) {
    const batch = sealed.slice(start, start + 128);
    const actual = (
      await git(root, ["hash-object", "--", ...batch.map((entry) => entry.path)])
    ).split("\n");
    for (const [index, entry] of batch.entries()) {
      if (actual[index] !== entry.hash)
        throw new Error(`Preserved fixture changed relative to ${commit}: ${entry.path}`);
    }
  }
  return commit;
}

if (import.meta.main) console.log(`Compatibility history verified against ${await checkHistory()}`);
