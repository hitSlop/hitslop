import { join } from "node:path";
import { buildRuntime } from "../v1/runtime";
import { output, executed } from "./common";
const started = performance.now();
await buildRuntime([join(output, "runtime")]);
await executed("runtime", started);
