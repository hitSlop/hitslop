CREATE TABLE publishers (
  key_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  publisher_key_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  categories TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_url TEXT,
  creation_count INTEGER NOT NULL DEFAULT 0,
  first_published_at TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  current_release_id TEXT NOT NULL,
  current_release_number INTEGER NOT NULL,
  current_published_at TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  artifact_bytes INTEGER NOT NULL,
  preview_key TEXT NOT NULL,
  preview_sha256 TEXT NOT NULL,
  preview_bytes INTEGER NOT NULL,
  icon_key TEXT NOT NULL,
  icon_sha256 TEXT NOT NULL,
  icon_bytes INTEGER NOT NULL,
  manifest_json TEXT NOT NULL
);

CREATE UNIQUE INDEX templates_publisher_slug ON templates(publisher_key_id, slug);
CREATE INDEX templates_catalog ON templates(visibility, creation_count, first_published_at, id);

CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  publisher_key_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  number INTEGER NOT NULL,
  artifact_key TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  artifact_bytes INTEGER NOT NULL,
  preview_key TEXT NOT NULL,
  preview_sha256 TEXT NOT NULL,
  preview_bytes INTEGER NOT NULL,
  icon_key TEXT NOT NULL,
  icon_sha256 TEXT NOT NULL,
  icon_bytes INTEGER NOT NULL,
  manifest_json TEXT NOT NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE publish_requests (
  id TEXT PRIMARY KEY,
  publisher_key_id TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  schema_hash TEXT NOT NULL,
  package_key TEXT NOT NULL,
  package_sha256 TEXT NOT NULL,
  package_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
