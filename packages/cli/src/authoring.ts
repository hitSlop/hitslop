import { resolve, join } from "node:path";
import { mkdtemp, rm, cp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { buildProject, buildRuntime, runtimeDirectory, repository } from "./build";
import { buildTemplate, prepareRenderer, installTemplate } from "./template";
export async function runAuthoring(
  command: "init" | "build" | "register" | "dev",
  target: string,
  port = 5173,
) {
  if (command === "init") {
    const source = join(repository, "packages/cli/templates/checklist");
    const destination = resolve(target);
    if (
      await stat(destination).then(
        () => true,
        () => false,
      )
    )
      throw new Error("Choose a new source directory");
    await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
    const metadata = await readFile(join(destination, "package.json"), "utf8");
    await writeFile(
      join(destination, "package.json"),
      metadata.replace("__HITSLOP_DOCUMENT__", join(repository, "packages/document")),
    );
    console.log(
      `Created ${destination}. Install its dependencies with bun install, then slop dev ${destination}.`,
    );
  } else if (command === "build") {
    console.log(await buildTemplate(target, await prepareRenderer()));
  } else if (command === "register") {
    const output = await buildTemplate(target, await prepareRenderer());
    const manifest = JSON.parse(await readFile(join(output, "manifest.json"), "utf8"));
    const templates = join(homedir(), ".hitslop/templates");
    await mkdir(templates, { recursive: true });
    const destination = join(templates, manifest.slug + ".slop");
    await installTemplate(output, destination);
    console.log(destination);
  } else if (command === "dev") {
    await buildRuntime();
    const temporary = await mkdtemp(join(tmpdir(), "hitslop-preview-"));
    const out = await buildProject(target, join(temporary, "preview.slop"));
    const server = Bun.serve({
      port,
      async fetch(request) {
        const url = new URL(request.url),
          relative = decodeURIComponent(url.pathname);
        const runtime = relative.startsWith("/__runtime__/");
        const base = runtime ? runtimeDirectory : out;
        const path = resolve(
          base,
          relative === "/" ? "app.html" : relative.slice(runtime ? 13 : 1),
        );
        if (!path.startsWith(base + "/")) return new Response("Forbidden", { status: 403 });
        const file = Bun.file(path);
        if (!(await file.exists())) return new Response("Not found", { status: 404 });
        return new Response(file, {
          headers: {
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'",
          },
        });
      },
    });
    console.log(`Disposable preview: ${server.url}`);
    process.on("SIGINT", async () => {
      server.stop();
      await rm(temporary, { recursive: true, force: true });
      process.exit(0);
    });
  }
}
