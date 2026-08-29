#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { devTemplate, packageAllTemplates, watchTemplate } from "../builder/templates.mjs";

const [command, target, ...options] = process.argv.slice(2);

try {
  if (command === "dev" && target) {
    const output = await devTemplate(target);
    console.log(output);
    if (process.platform === "darwin") spawnSync("open", [output], { stdio: "ignore" });
    console.log("watching for template changes — press Ctrl-C to stop");
    const watcher = watchTemplate(target, (error, rebuilt) => {
      if (error) console.error(error instanceof Error ? error.message : String(error));
      else console.log(`rebuilt ${rebuilt}`);
    });
    await new Promise((resolve) => {
      process.once("SIGINT", () => {
        watcher.close();
        resolve();
      });
      process.once("SIGTERM", () => {
        watcher.close();
        resolve();
      });
    });
  } else if (command === "package-templates") {
    const output = await packageAllTemplates({ check: options.includes("--check") || target === "--check" });
    console.log(output);
  } else {
    console.error("usage: slop-web dev <template-directory> | package-templates [--check]");
    process.exitCode = 64;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
