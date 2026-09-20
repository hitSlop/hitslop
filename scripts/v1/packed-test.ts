import { strict as assert } from "node:assert";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  cp,
  readlink,
  rename,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = await mkdtemp(join(tmpdir(), "hitslop packed "));
const repository = process.cwd();
const env = {
  ...process.env,
  HITSLOP_NATIVE_CLI: resolve("apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native"),
};
async function run(args: string[], cwd: string, overrides: Record<string, string> = {}) {
  const p = Bun.spawn(args, { cwd, env: { ...env, ...overrides }, stdout: "pipe", stderr: "pipe" });
  const [out, error, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  assert.equal(code, 0, out + error);
  console.log("PASS", args.slice(1, 4).join(" "));
  return out;
}
  const bin = join(root, "bin");
  await mkdir(bin);
  await symlink(process.execPath, join(bin, "bun"));
  const noNode = { PATH: bin + ":/usr/bin:/bin:/usr/sbin:/sbin" };
try {
  const tarballs = Object.fromEntries(
    ["cli", "document", "schema"].map((name) => [
      `@hitslop/${name}`,
      resolve(`generated/v1/npm/hitslop-${name}-1.0.0.tgz`),
    ]),
  );
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      private: true,
      dependencies: { "@hitslop/cli": tarballs["@hitslop/cli"] },
      overrides: tarballs,
    }),
  );
  await run([process.execPath, "install"], root, noNode);
  const cli = join(root, "node_modules/@hitslop/cli/src/cli.ts");
  const project = join(root, "my slop");
  await run(
    [process.execPath, "x", "--no-install", "@hitslop/cli", "init", project],
    root,
    noNode,
  );
  const metadata = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
  assert.equal(metadata.dependencies["@hitslop/document"], "1.0.0");
  metadata.overrides = tarballs;
  await writeFile(join(project, "package.json"), JSON.stringify(metadata));
  await run([process.execPath, "install"], project, noNode);
  await run([process.execPath, "run", "check"], project, noNode);
  await run([process.execPath, "run", "build"], project, noNode);
  const built = join(project, "dist/my-slop.slop");
  assert.ok((await readFile(join(built, "assets/main.css"), "utf8")).includes(".slop-paper"));
  assert.ok(!(await readFile(join(built, "assets/main.js"), "utf8")).includes(repository));
  const home = join(root, "home");
  await mkdir(home);
  await run([process.execPath, cli, "register", project], root, { ...noNode, HOME: home });
  await run([process.execPath, cli, "skills", "--all", "--scope", "project"], project, {
    ...noNode,
    HOME: home,
  });
  const links = [];
  for (const relative of new Bun.Glob("**/skills/*").scanSync({
    cwd: project,
    onlyFiles: false,
    dot: true,
  })) {
    const path = join(project, relative);
    const target = await readlink(path).catch(() => undefined);
    if (target && target.includes(".hitslop")) links.push(path);
  }
  assert.ok(links.length, "Skills must link to the durable cache");
  const packagedSkills = join(root, "node_modules/@hitslop/cli/.crust/root/skills");
  await rename(packagedSkills, packagedSkills + ".evicted");
  for (const link of links) assert.ok((await readFile(join(link, "SKILL.md"), "utf8")).length > 0);
  const document = join(root, "Document.slop");
  await cp(built, document, { recursive: true });
  await run(
    [process.execPath, cli, "theme", "set", document, "--values", '{"accent":"#123456"}'],
    root,
    noNode,
  );
  const theme = JSON.parse(
    await run([process.execPath, cli, "theme", "get", document], root, noNode),
  );
  assert.equal(theme.effective.accent, "#123456");
  for (const format of ["png", "pdf"])
    await run(
      [
        process.execPath,
        cli,
        "export",
        document,
        "--format",
        format,
        "--output",
        join(root, "output." + format),
      ],
      root,
      noNode,
    );
  const preview = Bun.spawn([process.execPath, cli, "dev", project, "--port", "5197"], {
    cwd: root,
    env: { ...env, ...noNode },
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    let ok = false;
    for (let i = 0; i < 1200; i++) {
      try {
        const r = await fetch("http://localhost:5197/");
        if (r.ok) {
          assert.ok((await r.text()).includes("main.css"));
          ok = true;
          break;
        }
      } catch {}
      await Bun.sleep(50);
    }
    if (!ok) {
      preview.kill("SIGINT");
      throw new Error("Packed preview failed: " + (await new Response(preview.stderr).text()));
    }
  } finally {
    preview.kill("SIGINT");
    await preview.exited;
  }
  // Compile the actual getting-started code, so documentation is an executable contract.
  const tutorial = await readFile(
    join(repository, "apps/landing/src/content/docs/docs/getting-started.mdx"),
    "utf8",
  );
  for (const match of tutorial.matchAll(/```(?:ts|svelte|css) title="([^"]+)"\n([\s\S]*?)\n```/g)) {
    await writeFile(join(project, match[1]!), match[2]!);
  }
  await run([process.execPath, "run", "check"], project, noNode);
  await run([process.execPath, "run", "build"], project, noNode);
  console.log(
    "PASS packed CLI outside checkout: init/install/check/dev/build/register/theme/export with Node absent",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
