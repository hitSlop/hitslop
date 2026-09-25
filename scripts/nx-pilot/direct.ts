import { slugs } from "./common";
import { verifySelected, assemble } from "./verify";
async function run(file: string, ...args: string[]) {
  const child = Bun.spawn([process.execPath, `scripts/nx-pilot/${file}.ts`, ...args], { stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error(`${file} failed`);
}
const portable = process.argv.includes("--portable");
await run("runtime");
const explicit = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
const selected = explicit.length ? [...new Set(explicit)] : slugs;
if (selected.some(slug => !slugs.includes(slug))) throw new Error("Unknown slop");
const pending = [...selected];
await Promise.all(Array.from({ length: 2 }, async () => {
  for (let slug; (slug = pending.shift());) await run("compile", slug);
}));
if (!portable) for (const slug of selected) await run("artwork", slug);
await verifySelected(selected, portable);
if (!portable && selected.length === slugs.length) await assemble();
