import { createAPIClient } from "@hitslop/api/client";
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { parseCatalogResponse, type CatalogTemplate } from "@hitslop/schema";
import { validateRuntimePackage } from "./runtime-package.ts";
import { loadManifest } from "./project.ts";
import { runNative } from "./native.ts";

export class DocumentCommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const catalogURL = (value?: string) => {
  const url = new URL(value ?? process.env.HITSLOP_CATALOG_URL ?? "https://api.hitslop.com");
  if (!["https:", "http:"].includes(url.protocol))
    throw new DocumentCommandError("invalid_request", "Catalog URL must be HTTP(S).");
  return new URL(url.origin);
};

export async function searchCatalog(
  query: string,
  options: { registry?: string; fetch?: typeof fetch } = {},
) {
  const url = catalogURL(options.registry);
  const client = createAPIClient(url, { ...(options.fetch ? { fetch: options.fetch } : {}) });
  let cursor: string | undefined;
  const templates = new Map<string, CatalogTemplate>();
  const cursors = new Set<string>();
  let complete = false;
  for (;;) {
    const response = await client.catalog
      .list(
        { ...(cursor ? { cursor } : {}), limit: "200" },
        { signal: AbortSignal.timeout(30_000) },
      )
      .catch((error) => {
        throw new DocumentCommandError(
          "catalog_unavailable",
          error instanceof Error ? error.message : "Catalog request failed.",
        );
      });
    const page = parseCatalogResponse(response);
    for (const entry of page.templates) templates.set(entry.id, entry);
    if (!page.nextCursor) {
      complete = true;
      break;
    }
    if (cursors.has(page.nextCursor))
      throw new DocumentCommandError("invalid_catalog", "Catalog repeated a pagination cursor.");
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const score = (entry: CatalogTemplate) => {
    const title = `${entry.title} ${entry.slug}`.toLocaleLowerCase();
    const metadata =
      `${title} ${entry.description} ${entry.categories.join(" ")} ${entry.author.name}`.toLocaleLowerCase();
    return terms.every((term) => metadata.includes(term))
      ? terms.reduce((total, term) => total + (title.includes(term) ? 3 : 1), 0)
      : -1;
  };
  const results = [...templates.values()]
    .filter((entry) => score(entry) >= 0)
    .sort(
      (a, b) =>
        score(b) - score(a) || b.creationCount - a.creationCount || a.id.localeCompare(b.id),
    );
  return { templates: results, complete, scanned: templates.size };
}

// Resolve existing ancestors too: a symlink into the catalog is still a master.
async function canonical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await canonical(parent), path.slice(parent.length));
  }
}
export async function assertDocumentDestination(path: string): Promise<void> {
  const target = (await canonical(resolve(path))).toLowerCase();
  const roots = [
    join(homedir(), ".hitslop/templates"),
    ...(process.env.HITSLOP_TEMPLATES_ROOT ? [process.env.HITSLOP_TEMPLATES_ROOT] : []),
  ];
  for (const directory of roots) {
    const root = (await canonical(resolve(directory))).toLowerCase();
    if (target === root || target.startsWith(root + sep)) {
      throw new DocumentCommandError(
        "managed_template",
        "Choose a document path outside the template cache.",
      );
    }
  }
}
const optionalText = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
export async function inspectDocument(path: string) {
  const root = resolve(path);
  const manifest = await loadManifest(root);
  await validateRuntimePackage(root, { allowMutableErrors: true });
  const schema = await optionalText(join(root, "data.schema.json"));
  const data = await optionalText(join(root, "stores/data.json"));
  let managed = false;
  try {
    await assertDocumentDestination(root);
  } catch (error) {
    if (!(error instanceof DocumentCommandError)) throw error;
    managed = true;
  }
  let parsed: unknown = null;
  let dataError: string | null = null;
  if (data !== null) {
    try {
      parsed = JSON.parse(data);
    } catch (error) {
      dataError = String(error);
    }
  }
  const candidate =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  const metadata = candidate?.$slop as Record<string, unknown> | undefined;
  const envelope =
    metadata?.format === 2 &&
    typeof metadata.baseRevision === "number" &&
    Number.isSafeInteger(metadata.baseRevision) &&
    metadata.baseRevision >= 0 &&
    ["documentId", "schemaHash", "authority"].every(
      (key) => typeof metadata[key] === "string" && metadata[key].length > 0,
    ) &&
    candidate &&
    "data" in candidate
      ? candidate
      : null;
  if (data !== null && !dataError && !envelope)
    dataError =
      "Unsupported document data: expected a v2 $slop envelope. Preserve the original and create a new document.";
  return {
    path: root,
    manifest,
    dataError,
    envelope: envelope?.$slop ?? null,
    schema: schema === null ? null : JSON.parse(schema),
    data: envelope ? envelope.data : null,
    dataExists: data !== null,
    dataPath: join(root, "stores/data.json"),
    editing: managed ? "template" : dataError ? "unsupported" : "versioned-json",
    guidance: await optionalText(
      join(root, ".agents/skills/hitslop-document/references/app-guide.md"),
    ),
  };
}

export async function createDocument(
  options: { template?: string; from?: string; output: string; registry?: string },
  native = runNative,
) {
  if (Boolean(options.template) === Boolean(options.from))
    throw new DocumentCommandError(
      "invalid_request",
      "Provide either a template ID or --from <built-package>.",
    );
  const output = resolve(
    options.output.endsWith(".slop") ? options.output : options.output + ".slop",
  );
  await assertDocumentDestination(output);
  if (
    await stat(output)
      .then(() => true)
      .catch(() => false)
  )
    throw new DocumentCommandError("destination_exists", `Destination already exists: ${output}`);
  if (options.from) {
    const source = resolve(options.from);
    await validateRuntimePackage(source, { template: true });
    await native(["create", "--from", source, "--output", output]);
    return { path: output, source };
  }
  const catalog = await searchCatalog("", options.registry ? { registry: options.registry } : {});
  const entry = catalog.templates.find((template) => template.id === options.template);
  if (!entry)
    throw new DocumentCommandError(
      "template_not_found",
      `Template ID not found${catalog.complete ? "" : " in this server's limited listing"}: ${options.template}`,
    );
  const suffix = `_${entry.slug}`;
  const publisher = entry.id.endsWith(suffix) ? entry.id.slice(0, -suffix.length) : "";
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(publisher))
    throw new DocumentCommandError("invalid_catalog", "Invalid publisher identity in template ID.");
  const key = new URL(entry.download.url).searchParams.get("key");
  if (key !== `artifacts/sha256/${entry.download.sha256}.slop.zip`)
    throw new DocumentCommandError("invalid_catalog", "Artifact key does not match its digest.");
  const temporary = await mkdtemp(join(tmpdir(), "hitslop-create-"));
  try {
    const descriptor = join(temporary, "template.json");
    await writeFile(
      descriptor,
      JSON.stringify({
        publisherKeyID: publisher,
        slug: entry.slug,
        release: entry.release.number,
        artifactKey: key,
        artifactSha256: entry.download.sha256,
        catalogURL: catalogURL(options.registry).origin,
      }),
    );
    await native(["create", "--catalog-entry", descriptor, "--output", output]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  return { path: output, templateId: entry.id, release: entry.release.number };
}

export async function openDocument(path: string, native = runNative) {
  const root = resolve(path);
  await assertDocumentDestination(root);
  await validateRuntimePackage(root, { allowMutableErrors: true });
  await native(["open", root]);
  return { path: root };
}

export async function applyDocument(path: string, json: string, native = runNative) {
  const root = resolve(path);
  await assertDocumentDestination(root);
  JSON.parse(json);
  await native(["apply", root, "--json", json]);
  return { path: root };
}
