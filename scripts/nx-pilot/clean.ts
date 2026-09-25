import { rm } from "node:fs/promises";
import { join } from "node:path";
import { output } from "./common";
// Only pilot-generated artifacts. Never documents, production outputs, or SwiftPM.
for (const name of ["runtime", "portable", "rendered"])
  await rm(join(output, name), { recursive: true, force: true });
if (process.argv.includes("--cache"))
  await rm(join(output, "../../.nx/cache"), { recursive: true, force: true });
