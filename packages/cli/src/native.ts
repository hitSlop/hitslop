import { access, constants } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

async function executable(path: string): Promise<boolean> {
  try { await access(path, constants.X_OK); return true; }
  catch { return false; }
}

export async function nativeOverride(): Promise<string | undefined> {
  const value = process.env.HITSLOP_NATIVE_CLI;
  if (value === undefined) return;
  const path = resolve(value);
  if (!value || !await executable(path)) throw new Error(`HITSLOP_NATIVE_CLI is not executable: ${value}`);
  return path;
}

export async function findNative(): Promise<string> {
  const override = await nativeOverride();
  if (override) return override;
  const candidates = [
    fileURLToPath(new URL("../../../apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native", import.meta.url)),
    "/Applications/hitSlop.app/Contents/Helpers/hitslop-native",
    join(homedir(), "Applications/hitSlop.app/Contents/Helpers/hitslop-native"),
  ];
  for (const path of candidates) if (await executable(path)) return path;
  throw new Error("Install hitSlop.app or run bun run swift:build to use native document commands");
}

export async function runNative(args: string[]) {
  const binary = await findNative();
  const child = Bun.spawn([binary, ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  if (code) process.exit(code);
}
