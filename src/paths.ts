import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export const DOCUMENT_SQLITE = "document.sqlite";

export function isAuthoringDir(path: string): boolean {
  return existsSync(join(path, "view.html")) && !existsSync(join(path, DOCUMENT_SQLITE));
}

export function isSlopPackage(path: string): boolean {
  try {
    return statSync(path).isDirectory() && existsSync(join(path, DOCUMENT_SQLITE));
  } catch {
    return false;
  }
}

/** Resolve a package directory or a bare sqlite file to the sqlite path. */
export function resolveDocument(path: string): string {
  const st = statSync(path);
  if (st.isDirectory()) {
    const inner = join(path, DOCUMENT_SQLITE);
    if (existsSync(inner)) return inner;
    throw new Error(`${path} is not a .slop package (missing ${DOCUMENT_SQLITE})`);
  }
  return path;
}

export function packageDirForDocument(sqlitePath: string): string | undefined {
  if (sqlitePath.endsWith(`/${DOCUMENT_SQLITE}`) || sqlitePath.endsWith(`\\${DOCUMENT_SQLITE}`)) {
    return sqlitePath.slice(0, -DOCUMENT_SQLITE.length - 1);
  }
}
