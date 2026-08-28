import QuickLookUI
import SlopCore
import SlopMacSupport
import UniformTypeIdentifiers

final class PreviewProvider: QLPreviewProvider {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let scoped = request.fileURL.startAccessingSecurityScopedResource()
        defer { if scoped { request.fileURL.stopAccessingSecurityScopedResource() } }
        if let preview = SlopPreviewAssets.previewURL(in: request.fileURL) {
            let reply = QLPreviewReply(fileURL: preview)
            if let title = try? SlopPackage(rootURL: request.fileURL).manifest.title {
                reply.title = title
            }
            return reply
        }
        let package = try SlopPackage(rootURL: request.fileURL)
        let title = Self.escape(package.manifest.title)
        let html = """
        <!doctype html><meta charset="utf-8"><style>
        html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#f4f0e5;color:#292720;font:16px -apple-system,system-ui}
        main{text-align:center;padding:48px}h1{font-size:32px;margin:0 0 10px}p{color:#777168;margin:0}
        </style><main><h1>\(title)</h1><p>Open in hitSlop to refresh this preview.</p></main>
        """
        let reply = QLPreviewReply(
            dataOfContentType: .html,
            contentSize: CGSize(width: package.manifest.window.width, height: package.manifest.window.height)
        ) { _ in Data(html.utf8) }
        reply.title = package.manifest.title
        return reply
    }

    private static func escape(_ value: String) -> String {
        value.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }
}
