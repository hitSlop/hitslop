import { constants } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, open, readlink, rename, rm, stat, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const managedSkillNames = ["hitslop-authoring", "hitslop-design", "hitslop-document"] as const;

export type SyncAgentSkillsOptions = {
  bundledRoot?: string;
  cacheRoot?: string;
  discoveryRoots?: string[];
  missingOnly?: boolean;
};

export type SyncAgentSkillsResult = { cache: string; installed: boolean; conflicts: string[] };

async function info(path: string) {
  try { return await lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

export function bundledSkillsRoot(): string {
  return fileURLToPath(new URL("../skills", import.meta.url));
}

export function defaultSkillsCacheRoot(): string {
  return process.env.HITSLOP_SKILLS_ROOT ?? join(homedir(), ".hitslop", "skills");
}

export function defaultSkillDiscoveryRoots(): string[] {
  const override = process.env.HITSLOP_SKILL_LINKS;
  if (override !== undefined) return override ? override.split(":").filter(Boolean) : [];
  return [join(homedir(), ".agents", "skills"), join(homedir(), ".claude", "skills")];
}

export async function syncAgentSkills(options: SyncAgentSkillsOptions = {}): Promise<SyncAgentSkillsResult> {
  const source = options.bundledRoot ?? bundledSkillsRoot();
  const cache = resolve(options.cacheRoot ?? defaultSkillsCacheRoot());
  await mkdir(dirname(cache), { recursive: true });
  const lock = await lockSkills(cache);
  try {
    // Both installers use this backup path, including recovery after process exit.
    const previous = `${cache}.previous`;
    if (!await info(cache) && await info(previous)) await rename(previous, cache);
    const missing = [];
    for (const name of managedSkillNames) {
      if (!await info(join(cache, name, "SKILL.md"))) missing.push(name);
    }
    const installed = !options.missingOnly || missing.length > 0;
    if (installed) {
      const staging = await mkdtemp(`${cache}.staging-`);
      try {
        if (options.missingOnly && await info(cache)) await cp(cache, staging, { recursive: true });
        for (const name of options.missingOnly ? missing : managedSkillNames) {
          if (!(await stat(join(source, name, "SKILL.md"))).isFile()) throw new Error(`Bundled skill is missing: ${name}`);
          await rm(join(staging, name), { recursive: true, force: true });
          await cp(join(source, name), join(staging, name), { recursive: true });
        }
        await rm(previous, { recursive: true, force: true });
        if (await info(cache)) await rename(cache, previous);
        try { await rename(staging, cache); }
        catch (error) {
          if (await info(previous)) await rename(previous, cache);
          throw error;
        }
      } finally { await rm(staging, { recursive: true, force: true }); }
      // Cleanup is best-effort: the new installation is already active.
      await rm(previous, { recursive: true, force: true }).catch(() => {});
    }
    const conflicts: string[] = [];
    for (const root of options.discoveryRoots ?? defaultSkillDiscoveryRoots()) {
      await mkdir(root, { recursive: true });
      for (const name of managedSkillNames) {
        const link = join(root, name), target = join(cache, name);
        const existing = await info(link);
        if (existing?.isSymbolicLink()) {
          const destination = resolve(dirname(link), await readlink(link));
          if (destination === target) continue;
          if (!destination.startsWith(`${cache}${sep}`)) { conflicts.push(link); continue; }
          await rm(link);
        } else if (existing) { conflicts.push(link); continue; }
        await symlink(target, link);
      }
    }
    return { cache, installed, conflicts };
  } finally { await lock.close(); }
}

// macOS open(O_EXLOCK) and Swift flock share the same OS lock. Closing the
// descriptor releases it, even after a crash; never unlink the lock file.
async function lockSkills(cache: string) {
  if (process.platform === "linux") {
    // util-linux flock holds the lock until this process closes its stdin.
    // Parent exit also closes the pipe, so there is no stale-lock recovery timer.
    const child = Bun.spawn(["flock", "--exclusive", "--wait", "2", `${cache}.lock`, "sh", "-c", "printf 'locked\\n'; cat >/dev/null"], {
      stdin: "pipe", stdout: "pipe", stderr: "pipe",
    });
    const reader = child.stdout.getReader();
    const ready = await reader.read();
    reader.releaseLock();
    if (ready.done) {
      await child.exited;
      throw new Error(`Could not lock agent skills: ${await new Response(child.stderr).text()}`);
    }
    return { close: async () => { await child.stdin.end(); await child.exited; } };
  }
  if (process.platform !== "darwin") throw new Error("Skill sync requires macOS or Linux. Install the bundled skills with your agent's skill installer on this platform.");
  const O_EXLOCK = 0x20;
  for (let attempt = 0; ; attempt++) {
    try { return await open(`${cache}.lock`, constants.O_CREAT | constants.O_RDWR | constants.O_NONBLOCK | O_EXLOCK, 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN" || attempt === 40) throw error;
      await Bun.sleep(50);
    }
  }
}
