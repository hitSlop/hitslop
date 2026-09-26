#!/usr/bin/env bun
import { defineExtension, defineExtensionId } from "@crustjs/core";
import { app } from "./app";
import { interactiveUpdates } from "./updates";

const skillCache = defineExtension(defineExtensionId("hitslop:skill-cache"), () => {
  let stabilize: (() => Promise<void>) | undefined;
  return {
    hooks: {
      async preRun(context) {
        if (context.commandPath[1] !== "skills" || context.commandPath[2] === "uninstall") return;
        const scope = context.flags.scope;
        const scopes =
          scope === "project" || scope === "global"
            ? ([scope] as const)
            : context.flags.all === true
              ? (["global"] as const)
              : (["project", "global"] as const);
        stabilize = await (await import("./skills-cache")).captureSkillLinks(scopes);
      },
      async postRun(_context, outcome) {
        if (outcome.status === "completed") await stabilize?.();
      },
    },
  };
});

const argv = process.argv.slice(2);
// Keep the pre-0.4 public spelling as an alias; generated docs use repair.
if ((argv[0] === "skills" || argv[0] === "skill") && argv[1] === "update") argv[1] = "repair";

await app
  .extend(skillCache())
  .extend(interactiveUpdates())
  .execute({ argv: argv.length ? argv : ["--help"] });
