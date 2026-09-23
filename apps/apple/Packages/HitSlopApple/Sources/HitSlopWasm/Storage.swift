import Darwin
import Foundation
import HitSlopCore
import SQLite3

func failure(_ message: String) -> NSError {
  NSError(domain: "hitSlop", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

/// The caller serializes database calls on queue. Swift never interprets Loro bytes.
final class Storage: @unchecked Sendable {
  static let maximumBytes: Int64 = 32 * 1024 * 1024
  static let maximumRows: Int64 = 4096
  let queue = DispatchQueue(label: "hitslop.sqlite")
  private var db: OpaquePointer?
  var testingPhase: ((String) -> Void)?
  private var ownership: DocumentWriterLock?
  private let root: URL
  private let inode: UInt64
  private func checkLocation() throws {
    let current = try FileManager.default.attributesOfItem(atPath: root.path)
    guard (current[.systemFileNumber] as? NSNumber)?.uint64Value == inode else {
      throw failure("Document moved or replaced; close before moving a document")
    }
  }
  init(root: URL) throws {
    self.root = root
    let attributes = try FileManager.default.attributesOfItem(atPath: root.path)
    guard let inode = (attributes[.systemFileNumber] as? NSNumber)?.uint64Value else {
      throw failure("Cannot identify document directory")
    }
    self.inode = inode
    ownership = try DocumentWriterLock(root: root)
    let state = root.appendingPathComponent("state")
    do {
      try safeFile(root.appendingPathComponent("state/document.sqlite"), optional: true)
      guard let resolved = Darwin.realpath(state.path, nil) else {
        throw failure("Cannot resolve storage directory")
      }
      let databasePath = String(cString: resolved) + "/document.sqlite"
      free(resolved)
      guard
        sqlite3_open_v2(
          databasePath, &db,
          SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX | SQLITE_OPEN_NOFOLLOW,
          nil) == SQLITE_OK
      else { throw error("open") }
      try exec("PRAGMA trusted_schema=OFF")
      sqlite3_limit(db, SQLITE_LIMIT_LENGTH, 32 * 1024 * 1024)
      let version = try scalar("PRAGMA user_version")
      guard version == 0 || version == 1 else { throw failure("Unsupported database format") }
      if version == 0 {
        let count = try scalar("SELECT count(*) FROM sqlite_master WHERE type='table'")
        guard count == 0 else { throw failure("Legacy database; migration is not implemented") }
      }
      try exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;")
      if version == 0 {
        try exec(
          "BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS document(id INTEGER PRIMARY KEY CHECK(id=1), checkpoint BLOB, schema_key TEXT, generation INTEGER NOT NULL); INSERT OR IGNORE INTO document VALUES(1,NULL,NULL,0); CREATE TABLE IF NOT EXISTS updates(seq INTEGER PRIMARY KEY, bytes BLOB NOT NULL); PRAGMA user_version=1; COMMIT;"
        )
      }
    } catch {
      close()
      throw error
    }
  }
  func close() {
    if let db {
      // All calls and teardown run on queue; no outstanding statement may outlive ownership.
      while let statement = sqlite3_next_stmt(db, nil) {
        NSLog("hitSlop: finalizing outstanding SQLite statement at close")
        sqlite3_finalize(statement)
      }
      let result = sqlite3_close_v2(db)
      guard result == SQLITE_OK else {
        NSLog("hitSlop: SQLite close failed (%d); retaining document ownership", result)
        return
      }
      self.db = nil
    }
    ownership?.close()
    ownership = nil
  }
  deinit { close() }
  private func error(_ action: String) -> NSError {
    failure("\(action): \(db.map { String(cString: sqlite3_errmsg($0)) } ?? "database closed")")
  }
  private func exec(_ sql: String) throws {
    guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw error(sql) }
  }
  private func statement(_ sql: String) throws -> OpaquePointer {
    var s: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &s, nil) == SQLITE_OK, let s else { throw error(sql) }
    return s
  }
  private func scalar(_ sql: String) throws -> Int64 {
    let s = try statement(sql)
    defer { sqlite3_finalize(s) }
    guard sqlite3_step(s) == SQLITE_ROW else { throw error(sql) }
    return sqlite3_column_int64(s, 0)
  }
  private func data(_ s: OpaquePointer, _ column: Int32) throws -> Data? {
    guard sqlite3_column_type(s, column) != SQLITE_NULL else { return nil }
    let size = Int(sqlite3_column_bytes(s, column))
    if size == 0 { return Data() }
    guard let pointer = sqlite3_column_blob(s, column) else { throw error("read blob") }
    return Data(bytes: pointer, count: size)
  }
  private func bind(_ data: Data, _ s: OpaquePointer, _ index: Int32) throws {
    let result = data.withUnsafeBytes {
      sqlite3_bind_blob(
        s, index, $0.baseAddress, Int32(data.count),
        unsafeBitCast(-1, to: sqlite3_destructor_type.self))
    }
    guard result == SQLITE_OK else { throw error("bind bytes") }
  }
  private func done(_ s: OpaquePointer) throws {
    guard sqlite3_step(s) == SQLITE_DONE else { throw error("write") }
  }
  private func checkBounds(additionalRows: Int64 = 0, additionalBytes: Int64 = 0) throws {
    let rows = try scalar("SELECT count(*) FROM updates")
    let bytes =
      try scalar("SELECT COALESCE(sum(length(bytes)),0) FROM updates")
      + scalar("SELECT COALESCE(length(checkpoint),0) FROM document WHERE id=1")
    let schemaBytes = try scalar(
      "SELECT COALESCE(length(CAST(schema_key AS BLOB)),0) FROM document WHERE id=1")
    guard schemaBytes <= 1_048_576, rows + additionalRows <= Self.maximumRows,
      bytes + additionalBytes <= Self.maximumBytes
    else {
      throw failure(
        "Document exceeds storage limits (32 MiB or 4096 updates); preserve the package for recovery"
      )
    }
  }
  func call(_ args: [String: Any]) throws -> [String: Any] {
    try checkLocation()
    let method = args["method"] as? String ?? ""
    if method == "attachments.list" { return ["files": try SlopAttachments.list(in: root)] }
    if method == "attachments.read" {
      guard let id = args["attachmentID"] as? String else { throw failure("Missing attachment ID") }
      return ["bytes": try SlopAttachments.read(id, in: root).base64EncodedString()]
    }
    if method == "attachments.put" {
      guard ownership != nil, let encoded = args["bytes"] as? String,
        encoded.utf8.count <= 13981016, let data = Data(base64Encoded: encoded) else {
        throw failure("Invalid attachment bytes")
      }
      return try SlopAttachments.put(data, in: root)
    }
    if method == "theme.load" || method == "theme.save" {
      let url = root.appendingPathComponent("state/theme.json")
      try safeFile(url, optional: true)
      if method == "theme.save" {
        guard let values = args["values"] as? [String: String] else {
          throw failure("Invalid theme values")
        }
        let bytes = try JSONSerialization.data(withJSONObject: values, options: [.sortedKeys])
        guard bytes.count <= 65536 else { throw failure("Theme exceeds 64 KiB") }
        try bytes.write(to: url, options: .atomic)
        return [:]
      }
      if !FileManager.default.fileExists(atPath: url.path) { return ["values": [String: String]()] }
      let bytes = try SlopFile.read(url, within: root, maximumBytes: 65536)
      guard let values = try JSONSerialization.jsonObject(with: bytes) as? [String: String] else {
        throw failure("Invalid theme overrides")
      }
      return ["values": values]
    }
    if method == "load" {
      // Aggregate lengths are checked before allocating or base64 encoding any blobs.
      try checkBounds()
      let s = try statement("SELECT checkpoint,schema_key,generation FROM document WHERE id=1")
      defer { sqlite3_finalize(s) }
      guard sqlite3_step(s) == SQLITE_ROW else { throw error("read") }
      let schema: Any = sqlite3_column_text(s, 1).map { String(cString: $0) } ?? NSNull() as Any
      let updates = try statement("SELECT bytes FROM updates ORDER BY seq")
      defer { sqlite3_finalize(updates) }
      var records: [String] = []
      var status = sqlite3_step(updates)
      while status == SQLITE_ROW {
        guard let bytes = try data(updates, 0) else { throw failure("Missing update bytes") }
        records.append(bytes.base64EncodedString())
        status = sqlite3_step(updates)
      }
      guard status == SQLITE_DONE else { throw error("read updates") }
      return [
        "checkpoint": try data(s, 0)?.base64EncodedString() ?? NSNull() as Any, "schemaKey": schema,
        "generation": String(sqlite3_column_int64(s, 2)), "updates": records,
      ]
    }
    try exec("BEGIN IMMEDIATE")
    do {
      guard
        args["generation"] as? String
          == String(try scalar("SELECT generation FROM document WHERE id=1"))
      else { throw failure("revision_conflict") }
      switch method {
      case "append":
        guard let updates = args["updates"] as? [String] else { throw failure("Missing updates") }
        guard !updates.isEmpty, updates.count <= Self.maximumRows else {
          throw failure("Invalid update count")
        }
        let incoming = try updates.map { encoded -> Data in
          guard let bytes = Data(base64Encoded: encoded), !bytes.isEmpty else {
            throw failure("Invalid update bytes")
          }
          return bytes
        }
        try checkBounds(
          additionalRows: Int64(incoming.count),
          additionalBytes: incoming.reduce(0) { $0 + Int64($1.count) })
        for bytes in incoming {
          let s = try statement("INSERT INTO updates(bytes) VALUES(?)")
          defer { sqlite3_finalize(s) }
          try bind(bytes, s, 1)
          try done(s)
        }
        try exec("UPDATE document SET generation=generation+1 WHERE id=1")
      case "checkpoint":
        guard let encoded = args["bytes"] as? String, let bytes = Data(base64Encoded: encoded),
          !bytes.isEmpty,
          let key = args["schemaKey"] as? String
        else { throw failure("Invalid checkpoint") }
        guard bytes.count <= Self.maximumBytes, key.utf8.count <= 1_048_576 else {
          throw failure("Document exceeds storage size limit")
        }
        let s = try statement(
          "UPDATE document SET checkpoint=?,schema_key=?,generation=generation+1 WHERE id=1")
        defer { sqlite3_finalize(s) }
        try bind(bytes, s, 1)
        guard
          sqlite3_bind_text(s, 2, key, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
            == SQLITE_OK
        else { throw error("bind schema key") }
        try done(s)
        try exec("DELETE FROM updates")
      default: throw failure("Unknown storage method")
      }
      testingPhase?(method + ":uncommitted")
      try exec("COMMIT")
      testingPhase?(method + ":committed")
      return ["generation": String(try scalar("SELECT generation FROM document WHERE id=1"))]
    } catch {
      try? exec("ROLLBACK")
      throw error
    }
  }
}
