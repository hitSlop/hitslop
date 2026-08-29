import HitSlopHost
import QuickLookUI
import UniformTypeIdentifiers

final class PreviewProvider: QLPreviewProvider {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let scoped = request.fileURL.startAccessingSecurityScopedResource()
        defer { if scoped { request.fileURL.stopAccessingSecurityScopedResource() } }
        let png = try await SlopRenderer.pngData(packageURL: request.fileURL)
        return QLPreviewReply(dataOfContentType: .png, contentSize: CGSize(width: 800, height: 600)) { _ in png }
    }
}
