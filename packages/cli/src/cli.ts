#!/usr/bin/env bun
import { defineExtension, defineExtensionId } from "@crustjs/core";
import { app } from "./app";

const skillCache = defineExtension(defineExtensionId("hitslop:skill-cache"), () => ({
  hooks: {
    async postRun(context, outcome) {
      if (outcome.status === "completed" && context.commandPath[1] === "skills") {
        await (await import("./skills-cache")).stabilizeSkillLinks();
      }
    },
  },
}));

await app
  .extend(skillCache())
  .execute({ argv: process.argv.length === 2 ? ["--help"] : process.argv.slice(2) });
