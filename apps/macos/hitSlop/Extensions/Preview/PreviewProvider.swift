import Cocoa
import Quartz
import UniformTypeIdentifiers

final class PreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let scoped = request.fileURL.startAccessingSecurityScopedResource()
        defer { if scoped { request.fileURL.stopAccessingSecurityScopedResource() } }
        let preview = request.fileURL.appendingPathComponent("QuickLook/Preview.png")
        if let png = try? Data(contentsOf: preview) {
            let size = NSImage(data: png)?.size ?? CGSize(width: 800, height: 600)
            return QLPreviewReply(dataOfContentType: .png, contentSize: size) { _ in png }
        }
        let title = (try? JSONSerialization.jsonObject(with: Data(contentsOf: request.fileURL.appendingPathComponent("manifest.json"))) as? [String: Any])?["title"] as? String ?? request.fileURL.deletingPathExtension().lastPathComponent
        let text = Data("\(title)\n\nhitSlop document".utf8)
        return QLPreviewReply(dataOfContentType: .plainText, contentSize: CGSize(width: 560, height: 360)) { _ in text }
    }
}
