#!/usr/bin/env node
import { buildSlop } from "../builder/index.mjs";

const [command, target] = process.argv.slice(2);

if (command !== "build" || !target) {
  console.error("usage: slop-web build <document.slop>");
  process.exit(1);
}

const result = await buildSlop(target);
const kb = (result.bytes / 1024).toFixed(1);
console.log(`built  ${result.entry}`);
console.log(`title  ${result.title}`);
console.log(`size   ${kb} kB`);
