import { runNative } from "./native";

export async function runDocumentCommand(command: string, target: string, rest: string[]) {
  if (process.platform !== "darwin")
    throw new Error("Document editing requires macOS and the installed hitslop-native helper.");
  await runNative([command, target, ...rest]);
}
