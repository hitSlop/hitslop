import { runNative } from "./native";

export async function runDocumentCommand(command: string, target: string, rest: string[]) {
  if (process.platform === "darwin" && process.env.HITSLOP_TEST_BUN_ENGINE !== "1") {
    await runNative([command, target, ...rest]);
    return;
  }
  const { runDevelopmentDocumentCommand } = await import("./development-documents");
  await runDevelopmentDocumentCommand(command, target, rest);
}
