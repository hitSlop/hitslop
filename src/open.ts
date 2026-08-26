import { spawn } from "node:child_process";
import { chmod, mkdir, copyFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
export const APP_PATH = join(ROOT, "host/HitSlop.app");
const EXEC = join(APP_PATH, "Contents/MacOS/HitSlop");
const SRC = join(ROOT, "host/main.swift");

export async function ensureApp(): Promise<string> {
  const plist = join(ROOT, "host/Info.plist");
  const native = join(ROOT, "host/native.js");
  if (!existsSync(SRC) || !existsSync(plist)) {
    throw new Error("missing host/main.swift or host/Info.plist");
  }
  await mkdir(join(APP_PATH, "Contents/MacOS"), { recursive: true });
  await mkdir(join(APP_PATH, "Contents/Resources"), { recursive: true });
  await copyFile(plist, join(APP_PATH, "Contents/Info.plist"));
  await copyFile(native, join(APP_PATH, "Contents/Resources/native.js"));
  await writeFile(join(APP_PATH, "Contents/PkgInfo"), "APPL????");

  const srcNewer = existsSync(EXEC) && existsSync(SRC)
    ? (await import("node:fs")).statSync(SRC).mtimeMs > (await import("node:fs")).statSync(EXEC).mtimeMs
    : true;
  if (!existsSync(EXEC) || srcNewer) {
    const proc = spawn(
      "swiftc",
      ["-O", "-framework", "Cocoa", "-framework", "WebKit", "-lsqlite3", SRC, "-o", EXEC],
      { stdio: "inherit" },
    );
    const code: number = await new Promise((resolve) => proc.on("exit", (c) => resolve(c ?? 1)));
    if (code !== 0) throw new Error("swiftc failed building HitSlop.app");
    await chmod(EXEC, 0o755);
    spawn("codesign", ["-s", "-", "--force", "--deep", APP_PATH], { stdio: "ignore" });
  }

  const lsregister =
    "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  if (existsSync(lsregister)) {
    spawn(lsregister, ["-f", APP_PATH], { stdio: "ignore" });
  }
  return APP_PATH;
}

export async function openApp(pkg: string): Promise<"app"> {
  const app = await ensureApp();
  spawn("open", ["-a", app, pkg], { stdio: "inherit" });
  return "app";
}
