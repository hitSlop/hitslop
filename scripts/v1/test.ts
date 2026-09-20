const files = [...new Bun.Glob("packages/{document,cli,schema}/tests/**/*.test.ts").scanSync(".")];
const child = Bun.spawn([process.execPath, "test", ...files.map((f) => "./" + f)], {
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await child.exited);
export {};
