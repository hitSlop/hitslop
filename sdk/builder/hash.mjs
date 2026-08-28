import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export function sha256(data) {
  return "sha256:" + createHash("sha256").update(data).digest("hex");
}

function sourceFiles(sourceRoot, directory = sourceRoot) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Source symlinks are not supported: ${entry.name}`);
    if (entry.name === ".build" || entry.name === "node_modules") {
      throw new Error(`Forbidden source path: ${entry.name}`);
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(sourceRoot, path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort((left, right) => {
    const leftPath = relative(sourceRoot, left);
    const rightPath = relative(sourceRoot, right);
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });
}

export function sourceHash(slopRoot) {
  const sourceRoot = join(slopRoot, "source");
  const hasher = createHash("sha256");
  for (const file of sourceFiles(sourceRoot)) {
    hasher.update(relative(sourceRoot, file).replaceAll("\\", "/"));
    hasher.update(readFileSync(file));
  }
  return "sha256:" + hasher.digest("hex");
}

export function stampManifest(slopRoot, manifest) {
  manifest.artifact ??= {};
  const entryPath = join(slopRoot, "build/index.html");
  const html = readFileSync(entryPath);
  manifest.artifact.sourceHash = sourceHash(slopRoot);
  manifest.artifact.artifactHash = sha256(html);
  writeFileSync(join(slopRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
