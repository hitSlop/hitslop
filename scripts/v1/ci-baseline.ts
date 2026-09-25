import { appendFile } from "node:fs/promises";
const event = await Bun.file(process.env.GITHUB_EVENT_PATH!).json();
let baseline = event.pull_request?.base?.sha ?? event.before;
if (process.env.GITHUB_REF?.startsWith("refs/tags/") || !baseline || /^0+$/.test(baseline)) {
  const child = Bun.spawn(
    ["git", "describe", "--tags", "--match", "macos-v*", "--abbrev=0", "HEAD^"],
    { stdout: "pipe", stderr: "ignore" },
  );
  const tag = (await new Response(child.stdout).text()).trim();
  baseline = (await child.exited) === 0 ? tag : "HEAD^";
}
if (!/^[a-zA-Z0-9._/^~-]+$/.test(baseline)) throw new Error("Invalid compatibility baseline");
await appendFile(process.env.GITHUB_ENV!, `HITSLOP_COMPAT_BASE=${baseline}\n`);
console.log(`Compatibility baseline: ${baseline}`);
