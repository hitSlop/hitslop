#!/usr/bin/env bun
import { Crust } from "@crustjs/core";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { validate, SlopCategorySchema, type SlopCategory } from "@hitslop/schema";
import { buildSlop, scaffold, validateAuthoringProject } from "./project.ts";
import { runDev } from "./dev.ts";
import { publishSlop } from "./publish.ts";
import { installTemplate } from "./install.ts";
import { exportIdentity, getIdentity, importIdentity } from "./identity.ts";
import { validateRuntimePackage } from "./runtime-package.ts";
import { exportDocument, screenshotDocument } from "./render.ts";
import { syncAgentSkills } from "./skills.ts";

const titleFor = (directory: string): string => directory.split("/").filter(Boolean).at(-1)?.split(/[-_ ]+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ") || "My Slop";

const parseCategories = (values: string[]): SlopCategory[] => values.map((value) => validate(SlopCategorySchema, value.trim().toLowerCase()));

async function initMetadata(directory: string, flags: { yes?: boolean | undefined; title?: string | undefined; description?: string | undefined; category?: string[] | undefined; "author-name"?: string | undefined; "author-url"?: string | undefined }) {
  const authorName = flags["author-name"]?.trim();
  const authorURL = flags["author-url"]?.trim();
  const defaults = { title: flags.title || titleFor(directory), description: flags.description || "A small, lovable hitSlop app.", categories: parseCategories(flags.category?.length ? flags.category : ["utilities"]) };
  if (flags.yes || !process.stdin.isTTY) {
    if (!authorName) throw new Error("--author-name is required with --yes or in a non-interactive terminal.");
    return { ...defaults, author: { name: authorName, ...(authorURL ? { url: authorURL } : {}) } };
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const title = (await prompt.question(`Title (${defaults.title}): `)).trim() || defaults.title;
    const description = (await prompt.question(`Description (${defaults.description}): `)).trim() || defaults.description;
    const rawCategories = (await prompt.question(`Categories, maximum 2 (${defaults.categories.join(", ")}): `)).trim();
    const categories = rawCategories ? parseCategories(rawCategories.split(",").filter(Boolean)) : defaults.categories;
    if (categories.length < 1 || categories.length > 2) throw new Error("Choose one or two categories.");
    const name = authorName || (await prompt.question("Author name: ")).trim();
    if (!name) throw new Error("Author name is required.");
    const url = authorURL || (await prompt.question("Author URL (optional): ")).trim();
    return { title, description, categories, author: { name, ...(url ? { url } : {}) } };
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
  template: { type: "string", description: "Svelte authoring template (svelte or svelte-counter)." },
  title: { type: "string", description: "Manifest title." }, description: { type: "string", description: "Manifest description." },
  "author-name": { type: "string", description: "Required manifest author name." }, "author-url": { type: "string", description: "Optional manifest author URL." },
  category: { type: "string", multiple: true, description: "Manifest category; pass once or twice." }, yes: { type: "boolean", description: "Accept manifest defaults without prompting." },
}).run(async ({ args, flags }) => {
  const metadata = await initMetadata(args.directory, flags);
  try {
    const result = await syncAgentSkills({ missingOnly: true });
    for (const path of result.conflicts) console.error(`Left existing skill at ${path} unchanged.`);
  }
  catch (error) { console.error(`Could not install coding-agent skills: ${error instanceof Error ? error.message : error}\nRun slop skills sync.`); }
  await scaffold(args.directory, { template: flags.template ?? "svelte-counter", ...metadata });
  console.log(`Created ${args.directory}`);
}));
app = app.command("validate", (command) => command.meta({ description: "Validate an authoring project or built .slop document." }).args([{ name: "path", type: "path", default: "." }] as const).run(async ({ args }) => {
  const runtime = await stat(join(args.path, "app.html")).then((value) => value.isFile()).catch(() => false);
  const manifest = runtime ? await validateRuntimePackage(args.path) : await validateAuthoringProject(args.path);
  console.log(`valid\t${manifest.slug}`);
}));
app = app.command("dev", (command) => command.meta({ description: "Preview the UI in a browser with disposable fake stores." }).args([{ name: "path", type: "path", default: "." }] as const).run(({ args }) => runDev(args.path)));
app = app.command("build", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).run(async ({ args }) => { const result = await buildSlop(args.path); console.log(result.directory); }));
app = app.command("register", (command) => command.meta({ description: "Build and register a template in the local hitSlop catalog." }).args([{ name: "path", type: "path", default: "." }] as const).flags({
  force: { type: "boolean", description: "Replace an existing local template without prompting." },
  preview: { type: "path", description: "Use this PNG instead of capturing a fresh native preview." },
  icon: { type: "path", description: "Use this 512x512 PNG as the catalog and Finder icon." },
}).run(async ({ args, flags }) => {
  const result = await installTemplate(args.path, { force: flags.force ?? false, ...(flags.preview ? { preview: flags.preview } : {}), ...(flags.icon ? { icon: flags.icon } : {}), confirmOverwrite: confirmReplacement });
  console.log(`${result.replaced ? "Updated" : "Installed"} ${result.manifest.title} at ${result.directory}`);
}));
app = app.command("publish", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).flags({ registry: { type: "string", description: "Catalog publish endpoint. Defaults to https://api.hitslop.com/api/publish. Set HITSLOP_REGISTRY_URL=http://127.0.0.1:5002/api/publish for the local Firebase emulators." }, preview: { type: "path" }, icon: { type: "path", description: "Use this 512x512 PNG as the catalog and Finder icon." } }).run(async ({ args, flags }) => {
  console.log(await publishSlop(args.path, { ...(flags.registry ? { registry: flags.registry } : {}), ...(flags.preview ? { preview: flags.preview } : {}), ...(flags.icon ? { icon: flags.icon } : {}) }));
}));
app = app.command("export", (command) => command.meta({ description: "Export a built .slop document as a full-height PNG or PDF." }).args([{ name: "path", type: "path", default: "." }] as const).flags({
  format: { type: "string", description: "Required output format: png or pdf." },
  output: { type: "path", description: "Required destination path." },
}).run(async ({ args, flags }) => {
  if (flags.format !== "png" && flags.format !== "pdf") throw new Error("--format must be png or pdf.");
  if (!flags.output) throw new Error("--output is required.");
  await exportDocument(args.path, { format: flags.format, output: flags.output });
}));
app = app.command("screenshot", (command) => command.meta({ description: "Capture a built .slop preview or icon render target." }).args([{ name: "path", type: "path", default: "." }] as const).flags({
  target: { type: "string", description: "Render target: preview (default) or icon." },
  output: { type: "path", description: "Required destination path." },
  "if-present": { type: "boolean", description: "Succeed without output when the target is absent." },
}).run(async ({ args, flags }) => {
  const target = flags.target ?? "preview";
  if (target !== "preview" && target !== "icon") throw new Error("--target must be preview or icon.");
  if (!flags.output) throw new Error("--output is required.");
  await screenshotDocument(args.path, { target, output: flags.output, ifPresent: flags["if-present"] ?? false });
}));

async function secret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("A TTY is required for identity passphrases.");
  process.stdout.write(prompt); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) { cleanup(); reject(new Error("Cancelled.")); return; }
        if (byte === 13 || byte === 10) { cleanup(); process.stdout.write("\n"); resolve(value); return; }
        if (byte === 127 || byte === 8) { value = value.slice(0, -1); continue; }
        value += String.fromCharCode(byte);
      }
    };
    const cleanup = () => { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); };
    process.stdin.on("data", onData);
  });
}

async function runIdentity(arguments_: string[]): Promise<boolean> {
  if (arguments_[0] !== "identity") return false;
  const action = arguments_[1] ?? "show";
  if (action === "show") { const identity = await getIdentity(); console.log(identity.keyId); return true; }
  if (action === "export") { const path = arguments_[2]; if (!path) throw new Error("Usage: slop identity export <file>"); const passphrase = await secret("Export passphrase: "); const confirmation = await secret("Confirm passphrase: "); if (passphrase !== confirmation) throw new Error("Passphrases do not match."); await exportIdentity(path, passphrase); console.log(`Exported publisher identity to ${path}`); return true; }
  if (action === "import") { const path = arguments_[2]; if (!path) throw new Error("Usage: slop identity import <file> [--force]"); const identity = await importIdentity(path, await secret("Import passphrase: "), arguments_.includes("--force")); console.log(identity.keyId); return true; }
  throw new Error(`Unknown identity command: ${action}`);
}

async function runSkills(arguments_: string[]): Promise<boolean> {
  if (arguments_[0] !== "skills") return false;
  const action = arguments_[1] ?? "sync";
  if (action === "sync") {
    const result = await syncAgentSkills();
    console.log(`Installed coding-agent skills at ${result.cache}`);
    for (const path of result.conflicts) console.error(`Left existing skill at ${path} unchanged. Remove it yourself if you want hitSlop to link its managed skill here.`);
    return true;
  }
  throw new Error("Usage: slop skills sync");
}

if (!await runIdentity(process.argv.slice(2)) && !await runSkills(process.argv.slice(2))) await app.execute();
