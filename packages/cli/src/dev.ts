import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { createServer } from "vite";
import { injectHost } from "./dev-bridge.ts";
import { loadManifest } from "./project.ts";

const exists = async (path: string): Promise<boolean> => { try { await stat(path); return true; } catch { return false; } };

/** Browser-only preview host. Durable storage behavior is tested in a built .slop. */
export function mockHostPlugin(options: { themeHref?: string } = {}): Plugin {
  return {
    name: "hitslop-browser-preview",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => injectHost(html, options),
    },
  };
}

export async function runDev(root: string): Promise<void> {
  await loadManifest(root);
  const themeHref = await exists(join(root, "assets", "theme.css")) ? "/assets/theme.css" : undefined;
  const server = await createServer({ root, plugins: [mockHostPlugin(themeHref ? { themeHref } : {})] });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Vite did not expose a development URL");
  console.log(`hitSlop UI preview: ${url}`);
  if (process.platform === "darwin") Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
}

export async function runNative(arguments_: string[]): Promise<void> {
  const override = process.env.HITSLOP_NATIVE_CLI;
  const arch = process.arch === "arm64" ? "arm64-apple-macosx" : "x86_64-apple-macosx";
  const repoDebugBin = resolve(import.meta.dir, `../../../apps/apple/Packages/HitSlopApple/.build/${arch}/debug/hitslop-native`);
  const repoReleaseBin = resolve(import.meta.dir, `../../../apps/apple/Packages/HitSlopApple/.build/${arch}/release/hitslop-native`);
  const candidates = [override, "/Applications/hitSlop.app/Contents/Helpers/hitslop-native", `${process.env.HOME}/Applications/hitSlop.app/Contents/Helpers/hitslop-native`, repoDebugBin, repoReleaseBin, "hitslop-native"].filter(Boolean) as string[];
  for (const executable of candidates) {
    try {
      const processResult = Bun.spawn([executable, ...arguments_], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
      const status = await processResult.exited; if (status === 0) return; if (executable === candidates.at(-1)) throw new Error(`hitslop-native failed with status ${status}`);
    } catch (error) { if (executable === candidates.at(-1)) throw error; }
  }
  throw new Error("Install hitSlop or set HITSLOP_NATIVE_CLI to use native rendering.");
}
