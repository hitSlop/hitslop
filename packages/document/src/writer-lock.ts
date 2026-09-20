import { dlopen, FFIType } from "bun:ffi";
import { mkdir, open, lstat, type FileHandle } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

// Spike adapter for macOS/Linux. The descriptor is held for the entire session.
// Never unlink a flock file: doing so would permit two independently locked inodes.
const libc = dlopen(process.platform === "darwin" ? "/usr/lib/libSystem.B.dylib" : "libc.so.6", {
  flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
});
export async function acquireWriter(root: string): Promise<FileHandle> {
  const state = join(root, "state");
  await mkdir(state, { recursive: false }).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  const info = await lstat(state);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("Unsafe document state directory");
  for (const name of ["document.sqlite", "document.sqlite-journal", "writer.lock"]) {
    const info = await lstat(join(state, name)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (info && (!info.isFile() || info.isSymbolicLink()))
      throw new Error("Unsafe document state file");
  }
  const fd = await open(
    join(state, "writer.lock"),
    constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW,
    0o600,
  );
  if (libc.symbols.flock(fd.fd, 2 | 4) !== 0) {
    await fd.close();
    throw Object.assign(new Error("Document has a live writer; route to its host or retry"), {
      code: "writer_busy",
    });
  }
  return fd;
}
