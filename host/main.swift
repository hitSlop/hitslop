import Cocoa
import SQLite3
import WebKit

let documentSQLite = "document.sqlite"
let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

func resolveDocument(_ path: String) -> String {
  var isDir: ObjCBool = false
  FileManager.default.fileExists(atPath: path, isDirectory: &isDir)
  if isDir.boolValue {
    return (path as NSString).appendingPathComponent(documentSQLite)
  }
  return path
}

final class SlopDB {
  private var db: OpaquePointer?

  init(path: String) throws {
    let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
    if sqlite3_open_v2(path, &db, flags, nil) != SQLITE_OK {
      throw slopError("open failed: \(errmsg)")
    }
    execRaw("PRAGMA busy_timeout = 5000")
    execRaw("PRAGMA foreign_keys = ON")
    execRaw("PRAGMA journal_mode = WAL")
    sqlite3_set_authorizer(db, { _, action, _, _, _, _ in
      if action == SQLITE_ATTACH || action == SQLITE_DETACH { return SQLITE_DENY }
      return SQLITE_OK
    }, nil)
  }

  var errmsg: String {
    String(cString: sqlite3_errmsg(db))
  }

  func execRaw(_ sql: String) {
    sqlite3_exec(db, sql, nil, nil, nil)
  }

  func checkpoint() {
    execRaw("PRAGMA wal_checkpoint(TRUNCATE)")
  }

  func close() {
    checkpoint()
    sqlite3_close(db)
    db = nil
  }

  func meta() -> [String: String] {
    var out: [String: String] = [:]
    for row in (try? query("SELECT key, value FROM slop_meta", params: [])) ?? [] {
      if let k = row["key"] as? String {
        out[k] = row["value"] as? String ?? "\(row["value"] ?? "")"
      }
    }
    return out
  }

  func viewHTML() -> String? {
    let rows = (try? query("SELECT body FROM slop_view WHERE path = ?", params: ["/"])) ?? []
    return rows.first?["body"] as? String
  }

  func asset(path: String) -> (mime: String, data: Data)? {
    let rows = (try? query(
      "SELECT mime, body FROM slop_assets WHERE path = ?",
      params: [path]
    )) ?? []
    guard let row = rows.first,
          let mime = row["mime"] as? String,
          let data = row["body"] as? Data else { return nil }
    return (mime, data)
  }

  func query(_ sql: String, params: [Any]) throws -> [[String: Any]] {
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
      throw slopError(errmsg)
    }
    defer { sqlite3_finalize(stmt) }
    try bind(stmt, params)
    var rows: [[String: Any]] = []
    while sqlite3_step(stmt) == SQLITE_ROW {
      var row: [String: Any] = [:]
      let n = sqlite3_column_count(stmt)
      for i in 0..<n {
        let name = String(cString: sqlite3_column_name(stmt, i))
        row[name] = value(stmt, i)
      }
      rows.append(row)
    }
    return rows
  }

  func exec(_ sql: String, params: [Any]) throws -> [String: Any] {
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
      throw slopError(errmsg)
    }
    defer { sqlite3_finalize(stmt) }
    try bind(stmt, params)
    let rc = sqlite3_step(stmt)
    if rc != SQLITE_DONE && rc != SQLITE_ROW {
      throw slopError(errmsg)
    }
    return [
      "changes": Int(sqlite3_changes(db)),
      "lastInsertRowid": sqlite3_last_insert_rowid(db),
    ]
  }

  private func bind(_ stmt: OpaquePointer?, _ params: [Any]) throws {
    for (i, p) in params.enumerated() {
      let idx = Int32(i + 1)
      switch p {
      case is NSNull:
        sqlite3_bind_null(stmt, idx)
      case let n as Int:
        sqlite3_bind_int64(stmt, idx, Int64(n))
      case let n as Int64:
        sqlite3_bind_int64(stmt, idx, n)
      case let n as Double:
        sqlite3_bind_double(stmt, idx, n)
      case let n as NSNumber:
        if CFGetTypeID(n) == CFBooleanGetTypeID() {
          sqlite3_bind_int(stmt, idx, n.boolValue ? 1 : 0)
        } else if CFNumberIsFloatType(n) {
          sqlite3_bind_double(stmt, idx, n.doubleValue)
        } else {
          sqlite3_bind_int64(stmt, idx, n.int64Value)
        }
      case let s as String:
        sqlite3_bind_text(stmt, idx, s, -1, SQLITE_TRANSIENT)
      default:
        sqlite3_bind_text(stmt, idx, String(describing: p), -1, SQLITE_TRANSIENT)
      }
    }
  }

  private func value(_ stmt: OpaquePointer?, _ i: Int32) -> Any {
    switch sqlite3_column_type(stmt, i) {
    case SQLITE_INTEGER: return sqlite3_column_int64(stmt, i)
    case SQLITE_FLOAT: return sqlite3_column_double(stmt, i)
    case SQLITE_NULL: return NSNull()
    case SQLITE_BLOB:
      let n = Int(sqlite3_column_bytes(stmt, i))
      if let ptr = sqlite3_column_blob(stmt, i) {
        return Data(bytes: ptr, count: n)
      }
      return Data()
    default:
      if let c = sqlite3_column_text(stmt, i) {
        return String(cString: c)
      }
      return NSNull()
    }
  }
}

func slopError(_ message: String) -> NSError {
  NSError(domain: "hitSlop", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

final class SchemeHandler: NSObject, WKURLSchemeHandler {
  let nativeJS: String
  weak var db: SlopDB?

  init(nativeJS: String) {
    self.nativeJS = nativeJS
  }

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else { return }
    let path = url.path
    if path == "/slop.js" || path.hasSuffix("/slop.js") {
      finish(task, data: Data(nativeJS.utf8), mime: "text/javascript")
      return
    }
    if path.hasPrefix("/assets"), let asset = db?.asset(path: String(path.dropFirst("/assets".count))) {
      finish(task, data: asset.data, mime: asset.mime)
      return
    }
    task.didFailWithError(slopError("not found"))
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

  private func finish(_ task: WKURLSchemeTask, data: Data, mime: String) {
    guard let url = task.request.url else { return }
    let response = URLResponse(
      url: url,
      mimeType: mime,
      expectedContentLength: data.count,
      textEncodingName: "utf-8"
    )
    task.didReceive(response)
    task.didReceive(data)
    task.didFinish()
  }
}

final class Bridge: NSObject, WKScriptMessageHandlerWithReply {
  let db: SlopDB
  init(db: SlopDB) { self.db = db }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage,
    replyHandler: @escaping (Any?, String?) -> Void
  ) {
    guard let body = message.body as? [String: Any],
          let op = body["op"] as? String else {
      replyHandler(nil, "bad message")
      return
    }
    let sql = body["sql"] as? String ?? ""
    let params = body["params"] as? [Any] ?? []
    do {
      switch op {
      case "query":
        let rows = try db.query(sql, params: params)
        replyHandler(["rows": rows, "columns": (rows.first ?? [:]).keys.sorted()], nil)
      case "exec":
        replyHandler(try db.exec(sql, params: params), nil)
      case "meta":
        replyHandler(db.meta(), nil)
      default:
        replyHandler(nil, "unknown op")
      }
    } catch {
      replyHandler(["error": error.localizedDescription], nil)
    }
  }
}

final class DocumentWindow: NSObject, NSWindowDelegate {
  let window: NSWindow
  let web: WKWebView
  let db: SlopDB
  let sqlitePath: String
  let scheme: SchemeHandler
  let bridge: Bridge
  var watcher: DispatchSourceFileSystemObject?
  var dirWatcher: DispatchSourceFileSystemObject?
  var watchFD: Int32 = -1
  var dirFD: Int32 = -1

  static var retained: [DocumentWindow] = []

  static func open(path: String) {
    do {
      let doc = try DocumentWindow(path: path)
      retained.append(doc)
      doc.window.makeKeyAndOrderFront(nil)
      NSApp.activate(ignoringOtherApps: true)
    } catch {
      let alert = NSAlert()
      alert.messageText = "Could not open"
      alert.informativeText = error.localizedDescription
      alert.runModal()
    }
  }

  init(path: String) throws {
    sqlitePath = resolveDocument(path)
    guard FileManager.default.fileExists(atPath: sqlitePath) else {
      throw slopError("not a .slop package (missing document.sqlite)")
    }
    db = try SlopDB(path: sqlitePath)
    bridge = Bridge(db: db)
    let meta = db.meta()
    let width = CGFloat(Double(meta["width"] ?? "420") ?? 420)
    let height = CGFloat(Double(meta["height"] ?? "720") ?? 720)
    let title = meta["title"] ?? (path as NSString).lastPathComponent

    let jsURL = Bundle.main.url(forResource: "native", withExtension: "js")
    let nativeJS = (jsURL.flatMap { try? String(contentsOf: $0, encoding: .utf8) }) ?? fallbackNativeJS

    scheme = SchemeHandler(nativeJS: nativeJS)
    scheme.db = db

    let config = WKWebViewConfiguration()
    config.setURLSchemeHandler(scheme, forURLScheme: "hitslop")
    config.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "slop")
    config.preferences.setValue(true, forKey: "developerExtrasEnabled")

    let frame = NSRect(x: 0, y: 0, width: width, height: height)
    window = NSWindow(
      contentRect: frame,
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = title
    window.center()
    window.isReleasedWhenClosed = false
    window.minSize = NSSize(width: 280, height: 360)

    web = WKWebView(frame: frame, configuration: config)
    window.contentView = web

    super.init()
    window.delegate = self
    loadView()
    startWatch()
  }

  func loadView() {
    guard let html = db.viewHTML() else { return }
    web.loadHTMLString(html, baseURL: URL(string: "hitslop://doc/"))
  }

  func startWatch() {
    watchFD = Darwin.open(sqlitePath, O_EVTONLY)
    if watchFD >= 0 {
      let src = DispatchSource.makeFileSystemObjectSource(
        fileDescriptor: watchFD,
        eventMask: [.write, .extend, .attrib],
        queue: .main
      )
      src.setEventHandler { [weak self] in self?.notifyChange() }
      src.resume()
      watcher = src
    }
    let dir = (sqlitePath as NSString).deletingLastPathComponent
    dirFD = Darwin.open(dir, O_EVTONLY)
    if dirFD >= 0 {
      let src = DispatchSource.makeFileSystemObjectSource(
        fileDescriptor: dirFD,
        eventMask: [.write, .extend],
        queue: .main
      )
      src.setEventHandler { [weak self] in self?.notifyChange() }
      src.resume()
      dirWatcher = src
    }
  }

  func notifyChange() {
    web.evaluateJavaScript(
      "window.dispatchEvent(new CustomEvent('slop:change', {detail:{type:'data'}}))"
    )
  }

  func windowWillClose(_ notification: Notification) {
    watcher?.cancel()
    dirWatcher?.cancel()
    if watchFD >= 0 { Darwin.close(watchFD) }
    if dirFD >= 0 { Darwin.close(dirFD) }
    db.close()
    DocumentWindow.retained.removeAll { $0 === self }
  }
}

let fallbackNativeJS = """
(() => {
  const call = (op, sql, params) =>
    window.webkit.messageHandlers.slop.postMessage({ op, sql: sql || "", params: params || [] });
  window.slop = {
    async query(sql, params = []) {
      const res = await call("query", sql, params);
      if (res && res.error) throw new Error(res.error);
      return res.rows;
    },
    async exec(sql, params = []) {
      const res = await call("exec", sql, params);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    async meta() { return call("meta", "", []); },
    onChange(cb) {
      const fn = (e) => cb(e.detail);
      window.addEventListener("slop:change", fn);
      return () => window.removeEventListener("slop:change", fn);
    },
  };
})();
"""

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ notification: Notification) {
    let args = CommandLine.arguments.dropFirst().filter { !$0.hasPrefix("-") }
    for a in args {
      DocumentWindow.open(path: a)
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
      if DocumentWindow.retained.isEmpty {
        self.showOpen()
      }
    }
  }

  func application(_ sender: NSApplication, openFile filename: String) -> Bool {
    DocumentWindow.open(path: filename)
    return true
  }

  func application(_ application: NSApplication, open urls: [URL]) {
    for url in urls { DocumentWindow.open(path: url.path) }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

  private func showOpen() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = true
    panel.allowsMultipleSelection = false
    panel.message = "Open a .slop package"
    panel.allowsOtherFileTypes = true
    if panel.runModal() == .OK, let url = panel.url {
      DocumentWindow.open(path: url.path)
    } else if DocumentWindow.retained.isEmpty {
      NSApp.terminate(nil)
    }
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
