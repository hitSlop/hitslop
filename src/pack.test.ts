import { describe, expect, test } from "bun:test";
import { cp, mkdtemp, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { pack } from "./pack.ts";
import { closeDocument, openDocument, query } from "./db.ts";
import { SLOP_APPLICATION_ID } from "./format.ts";
import { serveSlop } from "./serve.ts";
import { assertSafeSql } from "./sql-guard.ts";
import { DOCUMENT_SQLITE, isSlopPackage, resolveDocument } from "./paths.ts";

const SRC = join(import.meta.dir, "../examples/climbing");

async function packed(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "slop-test-"));
  const dest = join(dir, "climbing.slop");
  await pack(SRC, dest);
  return dest;
}

describe("pack layout", () => {
  test("emits a package directory with document.sqlite, no sibling wal after close", async () => {
    const pkg = await packed();
    expect(isSlopPackage(pkg)).toBe(true);
    const sqlite = resolveDocument(pkg);
    expect(sqlite).toBe(join(pkg, DOCUMENT_SQLITE));
    const st = await stat(pkg);
    expect(st.isDirectory()).toBe(true);

    const db = openDocument(pkg);
    const id = (db.query("PRAGMA application_id").get() as { application_id: number })
      .application_id;
    expect(id).toBe(SLOP_APPLICATION_ID);
    expect(Number(query(db, "SELECT count(*) AS n FROM routes").rows[0].n)).toBe(11);
    closeDocument(db, sqlite);

    expect(existsSync(`${pkg}-wal`)).toBe(false);
    expect(existsSync(`${pkg}-shm`)).toBe(false);
    expect(existsSync(`${sqlite}-wal`)).toBe(false);

    await rm(join(pkg, ".."), { recursive: true, force: true });
  });

  test("query via package path", async () => {
    const pkg = await packed();
    const db = openDocument(pkg);
    const { rows } = query(db, "SELECT value FROM slop_meta WHERE key = 'title'");
    expect(rows[0].value).toBe("Silo Wall");
    closeDocument(db, resolveDocument(pkg));
    await rm(join(pkg, ".."), { recursive: true, force: true });
  });
});

describe("sql guard", () => {
  test("blocks ATTACH", () => {
    expect(() => assertSafeSql("ATTACH 'other.slop' AS o")).toThrow();
  });
  test("blocks load_extension", () => {
    expect(() => assertSafeSql("SELECT load_extension('x')")).toThrow();
  });
  test("allows ordinary writes", () => {
    expect(() => assertSafeSql("UPDATE routes SET status = 'sent' WHERE id = 1")).not.toThrow();
  });
});

describe("serve round-trip", () => {
  test("click-shaped exec lands in document.sqlite; external write is readable", async () => {
    const pkg = await packed();
    const sqlite = resolveDocument(pkg);
    const db = openDocument(pkg);
    const served = await serveSlop({ db, slopPath: sqlite });

    const html = await fetch(served.url).then((r) => r.text());
    expect(html).toContain("Silo Wall");
    expect(html).toContain("/slop.js");

    const execRes = await fetch(`${served.url}slop/exec`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sql: "UPDATE routes SET status = ? WHERE name = ?",
        params: ["sent", "Bolt Tax"],
      }),
    }).then((r) => r.json());
    expect(execRes.changes).toBe(1);

    const outside = new Database(sqlite);
    const row = outside.query("SELECT status FROM routes WHERE name = 'Bolt Tax'").get() as {
      status: string;
    };
    expect(row.status).toBe("sent");
    outside.run("UPDATE routes SET status = 'attempted' WHERE name = 'Last Bus Home'");
    outside.close();

    const viaApi = await fetch(`${served.url}slop/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sql: "SELECT status FROM routes WHERE name = ?",
        params: ["Last Bus Home"],
      }),
    }).then((r) => r.json());
    expect(viaApi.rows[0].status).toBe("attempted");

    const blocked = await fetch(`${served.url}slop/exec`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sql: "ATTACH 'x.db' AS x", params: [] }),
    }).then((r) => r.json());
    expect(String(blocked.error)).toMatch(/not allowed/i);

    served.stop();
    closeDocument(db, sqlite);

    const copyDir = await mkdtemp(join(tmpdir(), "slop-copy-"));
    const copy = join(copyDir, "climbing.slop");
    await cp(pkg, copy, { recursive: true });
    expect(existsSync(join(copy, DOCUMENT_SQLITE))).toBe(true);
    expect(existsSync(`${copy}-wal`)).toBe(false);
    const copied = openDocument(copy);
    expect(query(copied, "SELECT status FROM routes WHERE name = 'Bolt Tax'").rows[0].status).toBe(
      "sent",
    );
    closeDocument(copied, join(copy, DOCUMENT_SQLITE));

    await rm(join(pkg, ".."), { recursive: true, force: true });
    await rm(copyDir, { recursive: true, force: true });
  });
});
