import Foundation
import HitSlopCore
import WebKit

final class SchemeHandler: NSObject, WKURLSchemeHandler {
  let headless: Bool
  let root: URL
  let runtime: URL
  init(root: URL, runtime: URL, headless: Bool = false) {
    self.headless = headless
    self.root = root
    self.runtime = runtime
  }
  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    do {
      guard let url = task.request.url, url.host == "app" else {
        throw failure("Unknown resource origin")
      }
      let isRuntime = url.path.hasPrefix("/__runtime__/")
      let base = (isRuntime ? runtime : root).standardizedFileURL
      let relative =
        isRuntime
        ? String(url.path.dropFirst("/__runtime__/".count))
        : (url.path == "/" ? "app.html" : String(url.path.dropFirst()))
      // Serve only authored resources, never state databases or discovery files.
      if !isRuntime
        && !(relative == "app.html" || relative == "state.schema.json" || relative == "initial.json"
          || relative.hasPrefix("assets/"))
      {
        throw failure("Resource not exposed")
      }
      let file = base.appendingPathComponent(relative).standardizedFileURL
      guard file.path.hasPrefix(base.path + "/") else { throw failure("Resource outside package") }
      let data: Data
      if headless && relative == "app.html" {
        data = Data(
          "<html><head><script type=\"module\" src=\"/__runtime__/headless.js\"></script></head><body></body></html>"
            .utf8)
      } else {
        guard !headless || isRuntime || ["state.schema.json", "initial.json", "assets/theme.json"].contains(relative)
        else { throw failure("App resources unavailable to headless engine") }
        data = try SlopFile.read(file, within: base)
      }
      let mime =
        [
          "html": "text/html; charset=utf-8", "js": "text/javascript", "wasm": "application/wasm",
          "json": "application/json", "css": "text/css",
          "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml",
          "webp": "image/webp", "gif": "image/gif",
          "woff": "font/woff", "woff2": "font/woff2", "ttf": "font/ttf", "mp3": "audio/mpeg",
          "mp4": "video/mp4",
        ][file.pathExtension] ?? "application/octet-stream"
      let headers = [
        "Content-Type": mime, "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; script-src slop: 'wasm-unsafe-eval'; connect-src slop:; style-src slop: 'unsafe-inline'; img-src slop: data:; font-src slop: data:",
      ]
      task.didReceive(
        HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
      task.didReceive(data)
      task.didFinish()
    } catch {
      NSLog(
        "hitSlop resource failed: %@ — %@", task.request.url?.absoluteString ?? "",
        error.localizedDescription)
      task.didFailWithError(error)
    }
  }
  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
