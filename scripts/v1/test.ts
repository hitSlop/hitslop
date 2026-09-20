const files = [...new Bun.Glob("packages/{document,cli,schema}/tests/**/*.test.ts").scanSync(".")];
const child = Bun.spawn([process.execPath, "test", ...files.map((f) => "./" + f)], {
  env: {...process.env,HITSLOP_NATIVE_CLI:process.env.HITSLOP_NATIVE_CLI ?? `${process.cwd()}/apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native`},
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await child.exited);
export {};
