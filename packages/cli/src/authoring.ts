import { resolve, join, basename } from "node:path";
import { mkdtemp, rm, cp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import metadata from "../package.json";
import type { SlopManifest } from "@hitslop/schema";
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
      "Read manifest.json, .agents/skills/hitslop-authoring/SKILL.md, and .agents/skills/hitslop-design/SKILL.md first. Choose a visual direction suited to the slop's purpose; the checklist is a functional starting point whose layout and appearance should be adapted to the task. Use plain CSS, defineTheme tokens, and typed document handles. Run bun run check and bun run build.\n",
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
    const frame = previewFrame(JSON.parse(await readFile(join(out, "manifest.json"), "utf8")));
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port,
      async fetch(request) {
        const url = new URL(request.url),
          relative = decodeURIComponent(url.pathname);
        if (relative === "/")
          return new Response(frame, {
            headers: {
              "Cache-Control": "no-store",
              "Content-Type": "text/html; charset=utf-8",
              "Content-Security-Policy":
                "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-src 'self'",
            },
          });
        const runtime = relative.startsWith("/__runtime__/");
        const base = runtime ? runtimeDirectory : out;
        const path = resolve(base, relative.slice(runtime ? 13 : 1));
        if (!path.startsWith(base + "/")) return new Response("Forbidden", { status: 403 });
        const file = Bun.file(path);
        if (!(await file.exists())) return new Response("Not found", { status: 404 });
        return new Response(file, {
          headers: {
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: blob:; media-src 'self' https: blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'",
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

/** Stands in for the native window: manifest size, shape mask, and backing or skin chrome. */
export function previewFrame(manifest: Pick<SlopManifest, "title" | "presentation">) {
  const presentation = manifest.presentation;
  const { width, height } = presentation;
  const window = [`width:${width}px`, `height:${height}px`];
  if ("skin" in presentation)
    window.push(
      ...["background", "-webkit-mask", "mask"].map(
        (property) => `${property}:url("/${presentation.skin}") 0 0/100% 100% no-repeat`,
      ),
    );
  else {
    const { shape = "rounded", background, resizable = true } = presentation;
    window.push(
      `border-radius:${shape === "ellipse" ? "50%" : shape === "capsule" ? "9999px" : "min(22px,50%)"}`,
    );
    if (background !== "transparent")
      window.push("background:Canvas", "box-shadow:0 18px 50px #0004,0 0 0 .5px #0003");
    if (resizable) window.push("resize:both", "min-width:240px", "min-height:180px");
    if (shape === "ellipse" && width === height) window.push("aspect-ratio:1");
  }
  const title = manifest.title.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} preview</title><style>html,body{margin:0;height:100%}body{display:grid;place-items:center;background:#e4e4e4 repeating-conic-gradient(#d2d2d2 0 25%,#e4e4e4 0 50%) 0 0/24px 24px}.window{overflow:hidden;${window.join(";")}}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><div class="window"><iframe src="/app.html" title="${title}"></iframe></div></body></html>`;
}
