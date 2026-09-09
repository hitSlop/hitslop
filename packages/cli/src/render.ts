import { runNative } from "./native.ts";
import { validateRuntimePackage } from "./runtime-package.ts";

export type NativeRunner = (arguments_: string[]) => Promise<void>;

export async function exportDocument(
  path: string,
  options: { format: "png" | "pdf"; output: string },
  native: NativeRunner = runNative,
): Promise<void> {
  await validateRuntimePackage(path);
  await native(["export", path, "--format", options.format, "--output", options.output]);
}

export async function screenshotDocument(
  path: string,
  options: { target?: "preview" | "icon"; output: string; ifPresent?: boolean },
  native: NativeRunner = runNative,
): Promise<void> {
  await validateRuntimePackage(path);
  await native([
    "screenshot",
    path,
    "--target",
    options.target ?? "preview",
    "--output",
    options.output,
    ...(options.ifPresent ? ["--if-present"] : []),
  ]);
}
