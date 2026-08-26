import AppKit
import QuickLookUI
import UniformTypeIdentifiers

final class PreviewProvider: QLPreviewProvider {
    enum PreviewError: Error { case invalidDocument }

    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let securityScoped = request.fileURL.startAccessingSecurityScopedResource()
        defer {
            if securityScoped { request.fileURL.stopAccessingSecurityScopedResource() }
        }

        let candidates = [
            request.fileURL.appendingPathComponent("preview.png"),
            request.fileURL.appendingPathComponent("QuickLook/Preview.png"),
            request.fileURL.appendingPathComponent("QuickLook/Thumbnail.png"),
        ]
        if let url = candidates.first(where: { FileManager.default.fileExists(atPath: $0.path) }) {
            let reply = QLPreviewReply(fileURL: url)
            reply.title = request.fileURL.deletingPathExtension().lastPathComponent
            return reply
        }

        let title = Self.escape(request.fileURL.deletingPathExtension().lastPathComponent)
        let html = """
        <!doctype html><meta charset="utf-8"><style>
        html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#111318;color:#f5f6f8;font:16px -apple-system,system-ui}
        main{text-align:center;padding:48px}h1{font-size:32px;margin:0 0 10px}p{color:#9ea4af;margin:0}
        </style><main><h1>\(title)</h1><p>Open in hitSlop to generate a live preview.</p></main>
        """
        let reply = QLPreviewReply(
            dataOfContentType: .html,
            contentSize: CGSize(width: 430, height: 620)
        ) { _ in Data(html.utf8) }
        reply.title = title
        return reply
    }

    private static func escape(_ value: String) -> String {
        value.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }
}
