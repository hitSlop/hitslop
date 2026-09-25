import { cp, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { prepareRenderer } from "../../packages/cli/src/template";
import { output, seal, verifySeal, executed, slugArgument } from "./common";
const slug = slugArgument();
const started = performance.now();
const source = join(output, "portable", slug);
await verifySeal(source);
const helper = await prepareRenderer();
const parent = join(output, "rendered");
await mkdir(parent, { recursive: true });
const stage = await mkdtemp(join(parent, `.stage-${slug}-`));
try {
  const pkg = join(stage, "package.slop");
  await cp(join(source, "package.slop"), pkg, { recursive: true });
  await mkdir(join(pkg, "QuickLook"));
  for (const [target, file] of [["preview", "Preview.png"], ["icon", "Icon.png"]]) {
    const child = Bun.spawn([helper, "screenshot", pkg, "--target", target!,
      ...(target === "icon" ? ["--if-present"] : []), "--output", join(pkg, "QuickLook", file!)],
      { stdout: "inherit", stderr: "inherit" });
    if (await child.exited) throw new Error(`Artwork failed: ${slug}/${target}`);
  }
  await seal(stage);
  await rm(join(parent, slug), { recursive: true, force: true });
  await rename(stage, join(parent, slug));
} finally {
  await rm(stage, { recursive: true, force: true });
}
await executed(`artwork:${slug}`, started);
