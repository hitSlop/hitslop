import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guestEntry, readManifest, sdkRoot } from "./config.mjs";

export async function withGuestWorkspace(slopRoot, run) {
  const manifest = readManifest(slopRoot);
  const dir = await mkdtemp(join(tmpdir(), "slop-"));
  const entry = guestEntry(slopRoot);
  await writeFile(
    join(dir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${manifest.title ?? "Slop"}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./entry.ts"></script>
  </body>
</html>
`
  );
  await writeFile(join(dir, "entry.ts"), `import ${JSON.stringify(entry)};\n`);
  await symlink(join(sdkRoot, "node_modules"), join(dir, "node_modules"), "dir");
  try {
    return await run(dir, manifest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
