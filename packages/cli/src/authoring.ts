import { resolve, join, basename } from "node:path";
import { mkdtemp, rm, cp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import metadata from "../package.json";
import { tmpdir, homedir } from "node:os";
import { buildProject, runtimeDirectory, cliRoot } from "./build";
import { buildTemplate, prepareRenderer, installTemplate } from "./template";
export async function runAuthoring(
  command: "init" | "build" | "register" | "dev",
  target: string,
  port = 5173,
) {
  if (command === "init") {
    const source = join(cliRoot, "templates/checklist");
    const destination = resolve(target);
    if (
      await stat(destination).then(
        () => true,
        () => false,
      )
    )
      throw new Error("Choose a new source directory");
    await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
    const name =
      basename(destination)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "my-slop";
    const project = JSON.parse(await readFile(join(destination, "package.json"), "utf8"));
    project.name = name;
    project.dependencies["@hitslop/document"] = metadata.version;
    project.devDependencies = { "@hitslop/cli": metadata.version };
    project.scripts = {
      dev: "slop dev .",
      check: "slop check .",
      build: "slop build .",
      register: "slop register .",
    };
    await writeFile(join(destination, "package.json"), JSON.stringify(project, null, 2) + "\n");
    const manifest = JSON.parse(await readFile(join(destination, "manifest.json"), "utf8"));
    manifest.slug = name;
    manifest.title = basename(destination);
    await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    await cp(join(cliRoot, "skills"), join(destination, ".agents/skills"), { recursive: true });
    await writeFile(
      join(destination, "AGENTS.md"),
      "Read manifest.json and .agents/skills/hitslop-authoring/SKILL.md first. Use plain CSS, defineTheme tokens, and typed document handles. Run bun run check and bun run build.\n",
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
    if (!(await Bun.file(join(runtimeDirectory, "index.js")).exists()))
      throw new Error("CLI preview runtime is missing. Reinstall @hitslop/cli.");
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
