import AppKit
import UniformTypeIdentifiers
@preconcurrency import WebKit

/// Saves files a slop offers with `<a download href="blob:…">`. WebKit writes into a
/// private staging file; the chosen destination is replaced only after a complete download.
@MainActor final class DocumentFileSaver: NSObject, WKDownloadDelegate {
  typealias Presenter = @MainActor (NSWindow, String, @escaping (URL?) -> Void) -> (() -> Void)
  static let maximumBytes: Int64 = 100 * 1024 * 1024

  private final class Transfer {
    var staging: URL?
    var destination: URL?
    var dismiss: (() -> Void)?
  }
  private let presenter: Presenter
  private var transfers: [ObjectIdentifier: Transfer] = [:]
  private var presenting = false
  var window: () -> NSWindow? = { nil }
  var onSaved: ((URL) -> Void)?
  var onFailed: ((String) -> Void)?
  var hasPendingSave: Bool { presenting }

  init(presenter: @escaping Presenter = DocumentFileSaver.presentSheet) {
    self.presenter = presenter
  }

  func begin(_ download: WKDownload) {
    transfers[ObjectIdentifier(download)] = Transfer()
    download.delegate = self
  }

  func cancel() {
    for transfer in transfers.values { transfer.dismiss?() }
  }

  func download(
    _ download: WKDownload, decideDestinationUsing response: URLResponse,
    suggestedFilename: String, completionHandler: @escaping @MainActor (URL?) -> Void
  ) {
    guard let transfer = transfers[ObjectIdentifier(download)], !presenting,
      response.expectedContentLength <= Self.maximumBytes,
      let window = window(), window.isVisible, window.attachedSheet == nil
    else { return refuse(download, completionHandler) }
    presenting = true
    var completed = false
    transfer.dismiss = presenter(window, Self.filename(suggestedFilename)) { [weak self] target in
      guard let self, !completed else { return }
      completed = true
      presenting = false
      transfer.dismiss = nil
      guard let target else { return refuse(download, completionHandler) }
      let staging = FileManager.default.temporaryDirectory
        .appendingPathComponent("hitslop-download-" + UUID().uuidString)
      transfer.staging = staging
      transfer.destination = target
      completionHandler(staging)
    }
  }

  func downloadDidFinish(_ download: WKDownload) {
    guard let transfer = transfers.removeValue(forKey: ObjectIdentifier(download)),
      let staging = transfer.staging, let destination = transfer.destination
    else { return }
    do {
      let size = try FileManager.default.attributesOfItem(atPath: staging.path)[.size] as? Int64 ?? 0
      guard size <= Self.maximumBytes else { throw CocoaError(.fileWriteOutOfSpace) }
      if FileManager.default.fileExists(atPath: destination.path) {
        _ = try FileManager.default.replaceItemAt(destination, withItemAt: staging)
      } else {
        try FileManager.default.moveItem(at: staging, to: destination)
      }
      onSaved?(destination)
    } catch {
      try? FileManager.default.removeItem(at: staging)
      onFailed?(error.localizedDescription)
    }
  }

  func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
    guard let transfer = transfers.removeValue(forKey: ObjectIdentifier(download)) else { return }
    transfer.dismiss?()
    if let staging = transfer.staging {
      try? FileManager.default.removeItem(at: staging)
      onFailed?(error.localizedDescription)
    }
  }

  private func refuse(_ download: WKDownload, _ completionHandler: @MainActor (URL?) -> Void) {
    transfers.removeValue(forKey: ObjectIdentifier(download))
    completionHandler(nil)
  }

  /// Suggested names come from authored code; keep only a plain file name.
  nonisolated static func filename(_ suggested: String) -> String {
    let name = (suggested as NSString).lastPathComponent
      .components(separatedBy: CharacterSet(charactersIn: ":/\\").union(.controlCharacters))
      .joined(separator: "-")
      .trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: ".")))
    return name.isEmpty ? "Download" : String(name.prefix(200))
  }

  private static func presentSheet(in window: NSWindow, filename: String,
    completion: @escaping (URL?) -> Void
  ) -> (() -> Void) {
    let panel = NSSavePanel()
    panel.nameFieldStringValue = filename
    let ext = (filename as NSString).pathExtension
    if !ext.isEmpty, let type = UTType(filenameExtension: ext) { panel.allowedContentTypes = [type] }
    panel.canCreateDirectories = true
    panel.beginSheetModal(for: window) { response in
      completion(response == .OK ? panel.url : nil)
    }
    return { panel.cancel(nil) }
  }
}
