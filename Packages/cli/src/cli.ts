#!/usr/bin/env bun
import { Crust } from "@crustjs/core";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { userInfo } from "node:os";
import { buildSlop, loadManifest, scaffold, writePackedSlop } from "./project.ts";
import { runDev, runNative } from "./dev.ts";
import { publishSlop } from "./publish.ts";
import { installTemplate } from "./install.ts";

const titleFor = (directory: string): string => directory.split("/").filter(Boolean).at(-1)?.split(/[-_ ]+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ") || "My Slop";

async function initMetadata(directory: string, flags: { yes?: boolean | undefined; title?: string | undefined; description?: string | undefined; author?: string | undefined; category?: string[] | undefined }) {
  const defaults = { title: flags.title || titleFor(directory), description: flags.description || "A small, lovable hitSlop app.", author: flags.author || userInfo().username, categories: flags.category?.length ? flags.category : ["Widgets"] };
  if (flags.yes || !process.stdin.isTTY) return defaults;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const title = (await prompt.question(`Title (${defaults.title}): `)).trim() || defaults.title;
    const description = (await prompt.question(`Description (${defaults.description}): `)).trim() || defaults.description;
    const author = (await prompt.question(`Author (${defaults.author}): `)).trim() || defaults.author;
    const rawCategories = (await prompt.question(`Categories, maximum 2 (${defaults.categories.join(", ")}): `)).trim();
    const categories = rawCategories ? rawCategories.split(",").map((item) => item.trim()).filter(Boolean) : defaults.categories;
    if (categories.length < 1 || categories.length > 2) throw new Error("Choose one or two categories.");
    return { title, description, author, categories };
  } finally { prompt.close(); }
}

async function confirmReplacement(target: string): Promise<boolean> {
  if (!process.stdin.isTTY) throw new Error(`Template already exists at ${target}. Pass --force to replace it non-interactively.`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try { return ["y", "yes"].includes((await prompt.question(`Replace the installed template at ${target}? [y/N] `)).trim().toLowerCase()); }
  finally { prompt.close(); }
}

let app = new Crust("slop").meta({ description: "Build small, self-contained hitSlop apps.", usage: "slop <command>" });
app = app.command("init", (command) => command.meta({ description: "Create a Svelte hitSlop project and manifest." }).args([{ name: "directory", type: "path", default: "my-slop" }] as const).flags({
  template: { type: "string", description: "Authoring template (currently svelte-counter)." },
  title: { type: "string", description: "Manifest title." }, description: { type: "string", description: "Manifest description." }, author: { type: "string", description: "Manifest author." },
  category: { type: "string", multiple: true, description: "Manifest category; pass once or twice." }, yes: { type: "boolean", description: "Accept manifest defaults without prompting." },
}).run(async ({ args, flags }) => { const metadata = await initMetadata(args.directory, flags); await scaffold(args.directory, { template: flags.template ?? "svelte-counter", ...metadata }); console.log(`Created ${args.directory}`); }));
app = app.command("validate", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).run(async ({ args }) => { const manifest = await loadManifest(args.path); console.log(`valid\t${manifest.slug}`); }));
app = app.command("dev", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).flags({ reset: { type: "boolean", description: "Reset isolated development stores." }, native: { type: "boolean", description: "Open the dev URL in hitSlop." } }).run(({ args, flags }) => runDev(args.path, { reset: flags.reset ?? false, native: flags.native ?? false })));
app = app.command("build", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).run(async ({ args }) => { const result = await buildSlop(args.path); console.log(result.directory); }));
app = app.command("install", (command) => command.meta({ description: "Build and install a template into the local hitSlop catalog." }).args([{ name: "path", type: "path", default: "." }] as const).flags({
  force: { type: "boolean", description: "Replace an existing local template without prompting." },
  screenshot: { type: "path", description: "Use this PNG instead of capturing a fresh native preview." },
}).run(async ({ args, flags }) => {
  const result = await installTemplate(args.path, { force: flags.force ?? false, ...(flags.screenshot ? { screenshot: flags.screenshot } : {}), confirmOverwrite: confirmReplacement });
  console.log(`${result.replaced ? "Updated" : "Installed"} ${result.manifest.title} at ${result.directory}`);
}));
app = app.command("pack", (command) => command.args([{ name: "path", type: "path", required: true }] as const).run(async ({ args }) => console.log(await writePackedSlop(args.path))));
app = app.command("screenshot", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).flags({ output: { type: "path" } }).run(async ({ args, flags }) => { const built = await buildSlop(args.path); const output = flags.output ?? join(args.path, "screenshots/cover.png"); await mkdir(dirname(output), { recursive: true }); await runNative(["screenshot", built.directory, "--output", output]); console.log(output); }));
app = app.command("publish", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).flags({ registry: { type: "string", description: "Catalog publish endpoint. Defaults to https://hitslop.app/api/publish. Set HITSLOP_REGISTRY_URL=http://localhost:3000/api/publish for a local catalog." }, screenshot: { type: "path", multiple: true }, publisher: { type: "string" } }).run(async ({ args, flags }) => {
  console.log(await publishSlop(args.path, { ...(flags.registry ? { registry: flags.registry } : {}), ...(flags.screenshot ? { screenshot: flags.screenshot } : {}), ...(flags.publisher ? { publisher: flags.publisher } : {}) }));
}));

await app.execute();
