import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Discovery skips missing executables; an executed command is never retried. */
export async function runNative(arguments_: string[]): Promise<void> {
  const override = process.env.HITSLOP_NATIVE_CLI;
  const arch = process.arch === "arm64" ? "arm64-apple-macosx" : "x86_64-apple-macosx";
  const build = resolve(import.meta.dir, "../../../apps/apple/Packages/HitSlopApple/.build", arch);
  const candidates = override !== undefined ? [override] : [
    "/Applications/hitSlop.app/Contents/Helpers/hitslop-native",
    join(homedir(), "Applications/hitSlop.app/Contents/Helpers/hitslop-native"),
    join(build, "debug/hitslop-native"), join(build, "release/hitslop-native"),
    "hitslop-native",
  ];
  await runNativeCandidates(candidates, arguments_, override !== undefined);
}

export async function runNativeCandidates(candidates: string[], arguments_: string[], explicit = false): Promise<void> {
  for (const executable of candidates) {
    let child;
    try {
      child = Bun.spawn([executable, ...arguments_], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    } catch (error) {
      if (!explicit && error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw new Error(`Could not launch native helper ${executable}`, { cause: error });
    }
    const status = await child.exited;
    if (status !== 0) throw new Error(`Native helper ${executable} failed with status ${status}`);
    return;
  }
  throw new Error("Install hitSlop or set HITSLOP_NATIVE_CLI to use native rendering.");
}
