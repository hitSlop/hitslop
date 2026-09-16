import type { CatalogTemplate, RegistryPublishResult, SlopManifest } from "@hitslop/schema";
import { fail } from "./errors.ts";

export type StoredAsset = { key: string; sha256: string; bytes: number };

export type ListedTemplate = Omit<CatalogTemplate, "preview" | "icon" | "download"> & {
  preview: StoredAsset;
  icon: StoredAsset;
  download: StoredAsset;
};

export type FinalizePublishInput = {
  requestId: string;
  publisherKeyId: string;
  publicKey: string;
  artifactKey: string;
  artifactSha256: string;
  artifactBytes: number;
  previewKey: string;
  previewSha256: string;
  previewBytes: number;
  iconKey: string;
  iconSha256: string;
  iconBytes: number;
  manifest: SlopManifest;
};

export type Member = { name: string; email: string };

export type SharedDocument = {
  id: string;
  owner: string;
  title: string;
  slug: string;
  schemaHash: string;
  packageKey: string;
  packageSha256: string;
  packageBytes: number;
  createdAt: string;
};

export interface Registry {
  getObject(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  finalizePublish(input: FinalizePublishInput): Promise<RegistryPublishResult>;
  listTemplates(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<{ templates: ListedTemplate[]; nextCursor: string | null }>;
  recordCreation(templateId: string): Promise<boolean>;
  putDocument(document: SharedDocument): Promise<void>;
  getDocument(id: string): Promise<SharedDocument | null>;
}

type BlobRecord = { bytes: Uint8Array; contentType: string };
type TemplateRow = ListedTemplate & {
  publisherKeyId: string;
  firstPublishedAt: string;
  visibility: string;
  manifestJSON: string;
  currentReleaseId: string;
};

const encodeCursor = (template: ListedTemplate) =>
  btoa(`${template.creationCount}\t${template.release.publishedAt}\t${template.id}`);

const decodeCursor = (cursor: string) => {
  try {
    const [creationCount, publishedAt, id] = atob(cursor).split("\t");
    if (!creationCount || !publishedAt || !id) return undefined;
    return { creationCount: Number(creationCount), publishedAt, id };
  } catch {
    return undefined;
  }
};

export class MemoryRegistry implements Registry {
  blobs = new Map<string, BlobRecord>();
  publishers = new Map<string, { publicKey: string; createdAt: string }>();
  templates = new Map<string, TemplateRow>();
  requests = new Map<
    string,
    { publisherKeyId: string; artifactSha256: string; result: RegistryPublishResult }
  >();
  documents = new Map<string, SharedDocument>();

  async getObject(key: string) {
    return this.blobs.get(key) ?? null;
  }
  async putObject(key: string, bytes: Uint8Array, contentType: string) {
    if (!this.blobs.has(key)) this.blobs.set(key, { bytes, contentType });
  }
  async objectExists(key: string) {
    return this.blobs.has(key);
  }

  async finalizePublish(input: FinalizePublishInput): Promise<RegistryPublishResult> {
    const requestId = `${input.publisherKeyId}_${input.requestId}`;
    const previous = this.requests.get(requestId);
    if (previous) {
      if (
        previous.publisherKeyId !== input.publisherKeyId ||
        previous.artifactSha256 !== input.artifactSha256
      ) {
        fail("Publish request id was reused with different content");
      }
      return previous.result;
    }
    const existingPublisher = this.publishers.get(input.publisherKeyId);
    if (existingPublisher && existingPublisher.publicKey !== input.publicKey)
      fail("Publisher key does not match its key id");
    const templateId = `${input.publisherKeyId}_${input.manifest.slug}`;
    const existing = this.templates.get(templateId);
    const now = new Date().toISOString();
    const releaseNumber = (existing?.release.number ?? 0) + 1;
    const releaseId = crypto.randomUUID();
    const result = { templateId, releaseId, releaseNumber };
    this.publishers.set(input.publisherKeyId, {
      publicKey: input.publicKey,
      createdAt: existingPublisher?.createdAt ?? now,
    });
    this.templates.set(templateId, {
      id: templateId,
      slug: input.manifest.slug,
      title: input.manifest.title,
      description: input.manifest.description,
      categories: input.manifest.categories,
      author: input.manifest.author.url
        ? { name: input.manifest.author.name, url: input.manifest.author.url }
        : { name: input.manifest.author.name },
      creationCount: existing?.creationCount ?? 0,
      release: { number: releaseNumber, publishedAt: now },
      preview: { key: input.previewKey, sha256: input.previewSha256, bytes: input.previewBytes },
      icon: { key: input.iconKey, sha256: input.iconSha256, bytes: input.iconBytes },
      download: {
        key: input.artifactKey,
        sha256: input.artifactSha256,
        bytes: input.artifactBytes,
      },
      publisherKeyId: input.publisherKeyId,
      firstPublishedAt: existing?.firstPublishedAt ?? now,
      visibility: existing?.visibility ?? "public",
      manifestJSON: JSON.stringify(input.manifest),
      currentReleaseId: releaseId,
    });
    this.requests.set(requestId, {
      publisherKeyId: input.publisherKeyId,
      artifactSha256: input.artifactSha256,
      result,
    });
    return result;
  }

  async listTemplates(options: { cursor?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;
    const sorted = [...this.templates.values()]
      .filter((template) => template.visibility === "public")
      .sort(
        (left, right) =>
          right.creationCount - left.creationCount ||
          right.release.publishedAt.localeCompare(left.release.publishedAt) ||
          left.id.localeCompare(right.id),
      );
    const start = cursor
      ? sorted.findIndex(
          (template) =>
            template.creationCount < cursor.creationCount ||
            (template.creationCount === cursor.creationCount &&
              template.release.publishedAt < cursor.publishedAt) ||
            (template.creationCount === cursor.creationCount &&
              template.release.publishedAt === cursor.publishedAt &&
              template.id > cursor.id),
        )
      : 0;
    const slice = sorted.slice(
      start < 0 ? sorted.length : start,
      (start < 0 ? sorted.length : start) + limit,
    );
    const listed = slice.map(
      ({
        publisherKeyId: _p,
        firstPublishedAt: _f,
        visibility: _v,
        manifestJSON: _m,
        currentReleaseId: _r,
        ...template
      }) => template,
    );
    const last = listed.at(-1);
    return {
      templates: listed,
      nextCursor: listed.length === limit && last ? encodeCursor(last) : null,
    };
  }

  async recordCreation(templateId: string) {
    const template = this.templates.get(templateId);
    if (!template || template.visibility !== "public") return false;
    template.creationCount += 1;
    return true;
  }

  async putDocument(document: SharedDocument) {
    if (this.documents.has(document.id)) fail("Document already exists", 409);
    this.documents.set(document.id, document);
  }
  async getDocument(id: string) {
    return this.documents.get(id) ?? null;
  }
}

type D1Template = {
  id: string;
  publisher_key_id: string;
  slug: string;
  title: string;
  description: string;
  categories: string;
  author_name: string;
  author_url: string | null;
  creation_count: number;
  first_published_at: string;
  visibility: string;
  current_release_id: string;
  current_release_number: number;
  current_published_at: string;
  artifact_key: string;
  artifact_sha256: string;
  artifact_bytes: number;
  preview_key: string;
  preview_sha256: string;
  preview_bytes: number;
  icon_key: string;
  icon_sha256: string;
  icon_bytes: number;
  manifest_json: string;
};

const listed = (row: D1Template): ListedTemplate => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  categories: JSON.parse(row.categories) as CatalogTemplate["categories"],
  author: row.author_url
    ? { name: row.author_name, url: row.author_url }
    : { name: row.author_name },
  creationCount: row.creation_count,
  release: { number: row.current_release_number, publishedAt: row.current_published_at },
  preview: { key: row.preview_key, sha256: row.preview_sha256, bytes: row.preview_bytes },
  icon: { key: row.icon_key, sha256: row.icon_sha256, bytes: row.icon_bytes },
  download: { key: row.artifact_key, sha256: row.artifact_sha256, bytes: row.artifact_bytes },
});

export class CloudflareRegistry implements Registry {
  constructor(
    private readonly db: D1Database,
    private readonly blobs: R2Bucket,
  ) {}

  async getObject(key: string) {
    const object = await this.blobs.get(key);
    if (!object) return null;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType: object.httpMetadata?.contentType || "application/octet-stream",
    };
  }
  async putObject(key: string, bytes: Uint8Array, contentType: string) {
    if (await this.blobs.head(key)) return;
    await this.blobs.put(key, bytes, {
      httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
    });
  }
  async objectExists(key: string) {
    return Boolean(await this.blobs.head(key));
  }

  async finalizePublish(input: FinalizePublishInput): Promise<RegistryPublishResult> {
    const requestId = `${input.publisherKeyId}_${input.requestId}`;
    const existingRequest = await this.db
      .prepare(
        "SELECT publisher_key_id, artifact_sha256, result_json FROM publish_requests WHERE id = ?",
      )
      .bind(requestId)
      .first<{ publisher_key_id: string; artifact_sha256: string; result_json: string }>();
    if (existingRequest) {
      if (
        existingRequest.publisher_key_id !== input.publisherKeyId ||
        existingRequest.artifact_sha256 !== input.artifactSha256
      ) {
        fail("Publish request id was reused with different content");
      }
      return JSON.parse(existingRequest.result_json) as RegistryPublishResult;
    }
    const publisher = await this.db
      .prepare("SELECT public_key FROM publishers WHERE key_id = ?")
      .bind(input.publisherKeyId)
      .first<{ public_key: string }>();
    if (publisher && publisher.public_key !== input.publicKey)
      fail("Publisher key does not match its key id");
    const templateId = `${input.publisherKeyId}_${input.manifest.slug}`;
    const existing = await this.db
      .prepare("SELECT * FROM templates WHERE id = ?")
      .bind(templateId)
      .first<D1Template>();
    const now = new Date().toISOString();
    const releaseNumber = (existing?.current_release_number ?? 0) + 1;
    const releaseId = crypto.randomUUID();
    const result = { templateId, releaseId, releaseNumber };
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO publishers(key_id, public_key, created_at, updated_at) VALUES(?,?,?,?) ON CONFLICT(key_id) DO UPDATE SET updated_at=excluded.updated_at",
        )
        .bind(input.publisherKeyId, input.publicKey, existing ? now : now, now),
      this.db
        .prepare(
          `INSERT INTO templates(
        id, publisher_key_id, slug, title, description, categories, author_name, author_url, creation_count, first_published_at, visibility,
        current_release_id, current_release_number, current_published_at, artifact_key, artifact_sha256, artifact_bytes,
        preview_key, preview_sha256, preview_bytes, icon_key, icon_sha256, icon_bytes, manifest_json
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, description=excluded.description, categories=excluded.categories, author_name=excluded.author_name, author_url=excluded.author_url,
        current_release_id=excluded.current_release_id, current_release_number=excluded.current_release_number, current_published_at=excluded.current_published_at,
        artifact_key=excluded.artifact_key, artifact_sha256=excluded.artifact_sha256, artifact_bytes=excluded.artifact_bytes,
        preview_key=excluded.preview_key, preview_sha256=excluded.preview_sha256, preview_bytes=excluded.preview_bytes,
        icon_key=excluded.icon_key, icon_sha256=excluded.icon_sha256, icon_bytes=excluded.icon_bytes, manifest_json=excluded.manifest_json`,
        )
        .bind(
          templateId,
          input.publisherKeyId,
          input.manifest.slug,
          input.manifest.title,
          input.manifest.description,
          JSON.stringify(input.manifest.categories),
          input.manifest.author.name,
          input.manifest.author.url ?? null,
          existing?.creation_count ?? 0,
          existing?.first_published_at ?? now,
          existing?.visibility ?? "public",
          releaseId,
          releaseNumber,
          now,
          input.artifactKey,
          input.artifactSha256,
          input.artifactBytes,
          input.previewKey,
          input.previewSha256,
          input.previewBytes,
          input.iconKey,
          input.iconSha256,
          input.iconBytes,
          JSON.stringify(input.manifest),
        ),
      this.db
        .prepare(
          `INSERT INTO releases(
        id, template_id, publisher_key_id, slug, number, artifact_key, artifact_sha256, artifact_bytes,
        preview_key, preview_sha256, preview_bytes, icon_key, icon_sha256, icon_bytes, manifest_json, published_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          releaseId,
          templateId,
          input.publisherKeyId,
          input.manifest.slug,
          releaseNumber,
          input.artifactKey,
          input.artifactSha256,
          input.artifactBytes,
          input.previewKey,
          input.previewSha256,
          input.previewBytes,
          input.iconKey,
          input.iconSha256,
          input.iconBytes,
          JSON.stringify(input.manifest),
          now,
        ),
      this.db
        .prepare(
          "INSERT INTO publish_requests(id, publisher_key_id, artifact_sha256, result_json, created_at) VALUES(?,?,?,?,?)",
        )
        .bind(requestId, input.publisherKeyId, input.artifactSha256, JSON.stringify(result), now),
    ]);
    return result;
  }

  async listTemplates(options: { cursor?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;
    const rows = cursor
      ? await this.db
          .prepare(
            `SELECT * FROM templates WHERE visibility = 'public' AND (
          creation_count < ? OR
          (creation_count = ? AND current_published_at < ?) OR
          (creation_count = ? AND current_published_at = ? AND id > ?)
        ) ORDER BY creation_count DESC, current_published_at DESC, id ASC LIMIT ?`,
          )
          .bind(
            cursor.creationCount,
            cursor.creationCount,
            cursor.publishedAt,
            cursor.creationCount,
            cursor.publishedAt,
            cursor.id,
            limit,
          )
          .all<D1Template>()
      : await this.db
          .prepare(
            `SELECT * FROM templates WHERE visibility = 'public' ORDER BY creation_count DESC, current_published_at DESC, id ASC LIMIT ?`,
          )
          .bind(limit)
          .all<D1Template>();
    const templates = (rows.results ?? []).map(listed);
    const last = templates.at(-1);
    return {
      templates,
      nextCursor: templates.length === limit && last ? encodeCursor(last) : null,
    };
  }

  async recordCreation(templateId: string) {
    const result = await this.db
      .prepare(
        "UPDATE templates SET creation_count = creation_count + 1 WHERE id = ? AND visibility = 'public'",
      )
      .bind(templateId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  async putDocument(document: SharedDocument) {
    const result = await this.db
      .prepare(
        `INSERT OR IGNORE INTO documents(
      id, owner, title, slug, schema_hash, package_key, package_sha256, package_bytes, created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        document.id,
        document.owner,
        document.title,
        document.slug,
        document.schemaHash,
        document.packageKey,
        document.packageSha256,
        document.packageBytes,
        document.createdAt,
      )
      .run();
    if (!result.meta.changes) fail("Document already exists", 409);
  }
  async getDocument(id: string) {
    const row = await this.db.prepare("SELECT * FROM documents WHERE id = ?").bind(id).first<{
      id: string;
      owner: string;
      title: string;
      slug: string;
      schema_hash: string;
      package_key: string;
      package_sha256: string;
      package_bytes: number;
      created_at: string;
    }>();
    if (!row) return null;
    return {
      id: row.id,
      owner: row.owner,
      title: row.title,
      slug: row.slug,
      schemaHash: row.schema_hash,
      packageKey: row.package_key,
      packageSha256: row.package_sha256,
      packageBytes: row.package_bytes,
      createdAt: row.created_at,
    };
  }
}
