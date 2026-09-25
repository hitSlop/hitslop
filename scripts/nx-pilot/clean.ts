import { rm } from "node:fs/promises";
import { join } from "node:path";
import { output } from "./common";
// Only pilot-generated artifacts. Never documents, production outputs, or SwiftPM.
for (const name of ["runtime", "portable", "rendered", "templates"])
  await rm(join(output, name), { recursive: true, force: true });
if (process.argv.includes("--cache")) {
  // nx.json pins a checkout-local cache. Its SQLite index lives separately;
  // removing artifacts alone can leave false local hits after a remote restore.
  for (const name of ["cache", "workspace-data"])
    await rm(join(output, "../../.nx", name), { recursive: true, force: true });
}
