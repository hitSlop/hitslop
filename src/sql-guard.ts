const DENY =
  /\b(ATTACH|DETACH|LOAD_EXTENSION|SQLITE_TEMP_MASTER|WRITABLE_SCHEMA|REKEY|HEXKEY)\b/i;

/** Block statements that could escape the document file. */
export function assertSafeSql(sql: string): void {
  if (DENY.test(sql)) {
    throw new Error("SQL not allowed in this document (ATTACH / extensions / rekey).");
  }
}
