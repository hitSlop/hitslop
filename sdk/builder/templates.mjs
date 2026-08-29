import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { buildSlop } from "./index.mjs";
import { sdkRoot } from "./config.mjs";

export const repoRoot = resolve(sdkRoot, "..");
export const authoredTemplatesRoot = join(repoRoot, "Templates");
export const bundledTemplatesRoot = join(
  repoRoot,
  "Packages/SlopTemplates/Sources/SlopTemplates/Resources/Templates",
);
const runFile = promisify(execFile);
const sqliteApplicationID = "1397510231";
const sqliteSchemaVersion = 1;

export async function authoredTemplateDirectories(root = authoredTemplatesRoot) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "template.json")))
    .map((entry) => join(root, entry.name))
    .sort();
}

export async function readTemplate(templateRoot) {
  const path = join(templateRoot, "template.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  if (manifest.format !== "slop-web/1") throw new Error(`Unsupported template format in ${path}`);
  if (!manifest.title || !manifest.id || !manifest.window || !Array.isArray(manifest.stores)) {
    throw new Error(`Incomplete template manifest: ${path}`);
  }
  if (manifest.artifact || manifest.appearance) {
    throw new Error(`Authoring manifests must not contain artifact or appearance metadata: ${path}`);
  }
  return manifest;
}

async function copyIfPresent(source, destination) {
  if (!existsSync(source)) return;
  await cp(source, destination, { recursive: true });
}

async function validateSQLiteStore(path) {
  let stdout;
  try {
    ({ stdout } = await runFile("sqlite3", [
      path,
      "PRAGMA application_id; PRAGMA user_version; PRAGMA journal_mode;",
    ]));
  } catch (error) {
    throw new Error(`Could not inspect SQLite template store ${path}: ${error.message}`);
  }

  const [applicationID, schemaVersion, journalMode] = stdout.trim().split(/\r?\n/);
  if (applicationID !== sqliteApplicationID) {
    throw new Error(
      `SQLite template store ${path} has application_id ${applicationID || "unset"}; expected ${sqliteApplicationID}.`,
    );
  }
  if (!Number.isInteger(Number(schemaVersion)) || Number(schemaVersion) > sqliteSchemaVersion) {
    throw new Error(
      `SQLite template store ${path} has unsupported user_version ${schemaVersion || "unset"}; maximum is ${sqliteSchemaVersion}.`,
    );
  }
  if (journalMode?.toLowerCase() !== "wal") {
    throw new Error(
      `SQLite template store ${path} uses journal_mode ${journalMode || "unset"}; expected WAL.`,
    );
  }
}

async function stageTemplate(templateRoot, stage, previewSource, storeSource = templateRoot) {
  const manifest = await readTemplate(templateRoot);
  await mkdir(join(stage, "build"), { recursive: true });
  await cp(join(templateRoot, "source"), join(stage, "source"), { recursive: true });
  await cp(join(templateRoot, "style.css"), join(stage, "style.css"));
  await writeFile(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  for (const store of manifest.stores) {
    const preserved = join(storeSource, store.path);
    const source = existsSync(preserved) ? preserved : join(templateRoot, store.path);
    if (store.kind === "sqlite") await validateSQLiteStore(source);
    const destination = join(stage, store.path);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }
  await copyIfPresent(join(templateRoot, "assets"), join(stage, "assets"));
  await buildSlop(stage);
  await rm(join(stage, "source"), { recursive: true, force: true });
  const previewRoot = existsSync(join(templateRoot, "QuickLook")) ? templateRoot : previewSource;
  await copyIfPresent(join(previewRoot, "QuickLook"), join(stage, "QuickLook"));
  return manifest;
}

async function replaceDirectory(stage, destination) {
  const parent = dirname(destination);
  const backup = join(parent, `.${basename(destination)}.old-${process.pid}`);
  await rm(backup, { recursive: true, force: true });
  if (existsSync(destination)) await rename(destination, backup);
  try {
    await rename(stage, destination);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (!existsSync(destination) && existsSync(backup)) await rename(backup, destination);
    throw error;
  }
}

export async function packageTemplate(
  templateRoot,
  destination,
  { previewSource = destination, preserveStores = false } = {},
) {
  await mkdir(dirname(destination), { recursive: true });
  const work = await mkdtemp(join(dirname(destination), ".slop-package-"));
  const stage = join(work, basename(destination));
  try {
    await stageTemplate(
      resolve(templateRoot),
      stage,
      previewSource,
      preserveStores ? destination : resolve(templateRoot),
    );
    await replaceDirectory(stage, destination);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return destination;
}

async function comparableFiles(root, directory = root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await comparableFiles(root, path)));
    else if (entry.isFile()) files.push(path.slice(root.length + 1));
  }
  return files.sort();
}

async function directoriesMatch(left, right) {
  const leftFiles = await comparableFiles(left);
  const rightFiles = await comparableFiles(right);
  if (JSON.stringify(leftFiles) !== JSON.stringify(rightFiles)) return false;
  for (const file of leftFiles) {
    const [leftData, rightData] = await Promise.all([
      readFile(join(left, file)),
      readFile(join(right, file)),
    ]);
    if (!leftData.equals(rightData)) return false;
  }
  return true;
}

export async function packageAllTemplates({ check = false } = {}) {
  const templates = await authoredTemplateDirectories();
  if (templates.length === 0) throw new Error(`No authored templates found in ${authoredTemplatesRoot}`);
  const parent = dirname(bundledTemplatesRoot);
  await mkdir(parent, { recursive: true });
  const work = await mkdtemp(join(parent, ".templates-package-"));
  const stageRoot = join(work, "Templates");
  await mkdir(stageRoot);
  try {
    for (const templateRoot of templates) {
      const manifest = await readTemplate(templateRoot);
      const name = `${manifest.title}.slop`;
      await stageTemplate(
        templateRoot,
        join(stageRoot, name),
        join(bundledTemplatesRoot, name),
      );
    }
    if (check) {
      if (!(await directoriesMatch(stageRoot, bundledTemplatesRoot))) {
        throw new Error("Bundled templates are stale. Run `slop package-templates`.");
      }
      return bundledTemplatesRoot;
    }
    await replaceDirectory(stageRoot, bundledTemplatesRoot);
    return bundledTemplatesRoot;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export async function devTemplate(templatePath) {
  const templateRoot = resolve(templatePath);
  const manifest = await readTemplate(templateRoot);
  const output = join(repoRoot, ".slop-dev", `${manifest.title}.slop`);
  await packageTemplate(templateRoot, output, { preserveStores: true });
  return output;
}

export function watchTemplate(templatePath, onBuild = () => {}) {
  const templateRoot = resolve(templatePath);
  let timeout;
  let building = false;
  let queued = false;

  const rebuild = async () => {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    try {
      const output = await devTemplate(templateRoot);
      onBuild(null, output);
    } catch (error) {
      onBuild(error);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        void rebuild();
      }
    }
  };

  const watcher = watch(templateRoot, { recursive: true }, () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => void rebuild(), 120);
  });
  return watcher;
}
