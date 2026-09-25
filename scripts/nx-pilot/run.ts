import { slugs } from "./common";
import { verifySelected, assemble } from "./verify";
const args = process.argv.slice(2);
const portable = args.includes("--portable");
const affected = args.includes("--affected");
const allowed = new Set(["--portable", "--affected", "--refresh-artwork"]);
if (args.some(arg => arg.startsWith("--") && !allowed.has(arg) && !/^--(?:base|head)=/.test(arg)))
  throw new Error("Usage: nx:pilot [slug] [--portable] [--affected --base=ref --head=ref] [--refresh-artwork]");
let selected = [...new Set(args.filter(arg => !arg.startsWith("--")))];
if (selected.some(slug => !slugs.includes(slug)) || (affected && selected.length))
  throw new Error("Expected discovered slugs, or --affected");
const nx = ["node", "node_modules/nx/dist/bin/nx.js"];
if (affected) {
  const child = Bun.spawn([...nx, "show", "projects", "--affected", "--with-target=compile", "--json",
    ...args.filter(arg => /^--(?:base|head)=/.test(arg))], { stdout: "pipe", stderr: "inherit" });
  const text = await new Response(child.stdout).text();
  if (await child.exited) throw new Error("Nx affected discovery failed");
  selected = JSON.parse(text).map((name: string) => name.replace(/^pilot-/, ""));
} else if (!selected.length) selected = slugs;
if (!selected.length) { console.log("No affected slops"); process.exit(0); }
if (args.includes("--refresh-artwork")) {
  if (portable) throw new Error("Artwork refresh requires macOS artwork");
  // Preserve portable reuse; directly rerender snapshots, then validate below.
  const compile = Bun.spawn([...nx, "run-many", "-t", "compile", "-p", selected.map(s => `pilot-${s}`).join(","), "--parallel=2", "--outputStyle=static"], { stdout: "inherit", stderr: "inherit" });
  if (await compile.exited) throw new Error("Compilation failed");
  for (const slug of selected) {
    const child = Bun.spawn([process.execPath, "scripts/nx-pilot/artwork.ts", slug], { stdout: "inherit", stderr: "inherit" });
    if (await child.exited) throw new Error(`Artwork refresh failed: ${slug}`);
  }
} else {
  const child = Bun.spawn([...nx, "run-many", "-t", portable ? "compile" : "artwork", "-p", selected.map(s => `pilot-${s}`).join(","), "--parallel=2", "--outputStyle=static"], { stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error("Nx build failed");
}
await verifySelected(selected, portable);
if (!portable && selected.length === slugs.length) await assemble();
