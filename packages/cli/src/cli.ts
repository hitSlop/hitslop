#!/usr/bin/env bun
import { app } from "./app";
await app.execute({ argv: process.argv.length === 2 ? ["--help"] : process.argv.slice(2) });
if (["skills", "skill"].includes(process.argv[2] ?? "")) {
  await (await import("./skills-cache")).stabilizeSkillLinks();
}
