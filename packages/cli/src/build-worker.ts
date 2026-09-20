import { stop } from "esbuild";
import { buildProjectInBun } from "./build";
try {
  console.log(await buildProjectInBun(process.argv[2]!, process.argv[3]));
} finally {
  stop();
}
