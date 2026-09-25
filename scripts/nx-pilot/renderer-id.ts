// Hash the selected OS/toolchain, not a non-reproducible Swift debug executable.
if (process.platform !== "darwin") throw new Error("Artwork requires macOS");
for (const command of [["sw_vers", "-buildVersion"], ["xcodebuild", "-version"], ["swift", "--version"]]) {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code) throw new Error(stderr);
  console.log(stdout.trim());
}
console.log(process.arch);
