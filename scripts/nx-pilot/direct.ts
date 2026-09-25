import { slugs } from "./common";
async function run(file: string, ...args: string[]) {
  const child = Bun.spawn([process.execPath, `scripts/nx-pilot/${file}.ts`, ...args], { stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error(`${file} failed`);
}
await run("runtime");
await Promise.all(slugs.map(slug => run("compile", slug)));
for (const slug of slugs) {
  if (!process.argv.includes("--portable")) await run("artwork", slug);
  await run("verify", slug, ...(process.argv.includes("--portable") ? ["--portable"] : []));
}
