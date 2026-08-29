#!/usr/bin/env bun
import { Crust } from "@crustjs/core";
import { canonicalPublishEnvelope, type PublishEnvelope } from "@hitslop/schema";
import { dirname, resolve, join } from "node:path";
import { mkdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { userInfo } from "node:os";
import { buildSlop, loadManifest, packSlop, scaffold, sha256, writePackedSlop } from "./project.ts";
import { runDev, runNative } from "./dev.ts";
import { getIdentity, sign } from "./identity.ts";

const cwd = (path?: string): string => resolve(path ?? ".");
const contentType = (path: string): "image/png" | "image/jpeg" | "image/webp" => path.endsWith(".webp") ? "image/webp" : path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "image/png";
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

let app = new Crust("slop").meta({ description: "Build small, self-contained hitSlop apps.", usage: "slop <command>" });
app = app.command("init", (command) => command.meta({ description: "Create a Svelte hitSlop project and manifest." }).args([{ name: "directory", type: "path", default: "my-slop" }] as const).flags({
  template: { type: "string", description: "Authoring template (currently svelte-counter)." },
  title: { type: "string", description: "Manifest title." }, description: { type: "string", description: "Manifest description." }, author: { type: "string", description: "Manifest author." },
  category: { type: "string", multiple: true, description: "Manifest category; pass once or twice." }, yes: { type: "boolean", description: "Accept manifest defaults without prompting." },
}).run(async ({ args, flags }) => { const metadata = await initMetadata(args.directory, flags); await scaffold(args.directory, { template: flags.template ?? "svelte-counter", ...metadata }); console.log(`Created ${args.directory}`); }));
app = app.command("validate", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).run(async ({ args }) => { const manifest = await loadManifest(args.path); console.log(`valid\t${manifest.format}\t${manifest.slug}`); }));
app = app.command("dev", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).flags({ reset: { type: "boolean", description: "Reset isolated development stores." }, native: { type: "boolean", description: "Open the dev URL in hitSlop." } }).run(({ args, flags }) => runDev(args.path, { reset: flags.reset ?? false, native: flags.native ?? false })));
app = app.command("build", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).run(async ({ args }) => { const result = await buildSlop(args.path); console.log(result.directory); }));
app = app.command("pack", (command) => command.args([{ name: "path", type: "path", required: true }] as const).run(async ({ args }) => console.log(await writePackedSlop(args.path))));
app = app.command("screenshot", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).flags({ output: { type: "path" } }).run(async ({ args, flags }) => { const built = await buildSlop(args.path); const output = flags.output ?? join(args.path, "screenshots/cover.png"); await mkdir(dirname(output), { recursive: true }); await runNative(["screenshot", built.directory, "--output", output]); console.log(output); }));
app = app.command("publish", (command) => command.args([{ name: "path", type: "path", default: "." }] as const).flags({ registry: { type: "string", description: "Catalog publish endpoint." }, screenshot: { type: "path", multiple: true }, publisher: { type: "string" } }).run(async ({ args, flags }) => {
  const built = await buildSlop(args.path); const packed = await packSlop(built.directory);
  const screenshotPaths = flags.screenshot?.length ? flags.screenshot : [join(args.path, "screenshots/cover.png")];
  if (!await stat(screenshotPaths[0]!).then(() => true).catch(() => false)) { await mkdir(join(args.path, "screenshots"), { recursive: true }); await runNative(["screenshot", built.directory, "--output", screenshotPaths[0]!]); }
  const screenshots = await Promise.all(screenshotPaths.map(async (path) => { const bytes = new Uint8Array(await Bun.file(path).arrayBuffer()); return { path, bytes, sha256: sha256(bytes), contentType: contentType(path) }; }));
  const identity = await getIdentity(flags.publisher ?? built.manifest.author.name); const manifestBytes = await Bun.file(join(built.directory, "manifest.json")).bytes();
  const envelope: PublishEnvelope = { format: "hitslop-publish/1", requestId: crypto.randomUUID(), publisherKeyId: identity.keyId, publicKey: identity.publicKey, displayName: identity.displayName, slug: built.manifest.slug, manifestSha256: sha256(manifestBytes), artifactSha256: packed.sha256, artifactBytes: packed.bytes.byteLength, screenshots: screenshots.map(({ sha256: hash, bytes, contentType: type }) => ({ sha256: hash, bytes: bytes.byteLength, contentType: type })), timestamp: Date.now() };
  const signature = await sign(canonicalPublishEnvelope(envelope), identity); const form = new FormData(); form.set("envelope", JSON.stringify(envelope)); form.set("signature", signature); form.set("manifest", new Blob([Uint8Array.from(manifestBytes).buffer], { type: "application/json" }), "manifest.json"); form.set("artifact", new Blob([Uint8Array.from(packed.bytes).buffer], { type: "application/zip" }), `${built.manifest.slug}.slop.zip`); screenshots.forEach((shot) => form.append("screenshots", new Blob([Uint8Array.from(shot.bytes).buffer], { type: shot.contentType }), shot.path.split("/").at(-1)));
  const endpoint = flags.registry ?? process.env.HITSLOP_REGISTRY_URL ?? "http://localhost:3000/api/publish"; const response = await fetch(endpoint, { method: "POST", body: form }); const body = await response.text(); if (!response.ok) throw new Error(`Publish failed (${response.status}): ${body}`); console.log(body);
}));

await app.execute();
