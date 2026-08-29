import QuickLookUI
import HitSlopCore
import UniformTypeIdentifiers

final class PreviewProvider: QLPreviewProvider {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let scoped = request.fileURL.startAccessingSecurityScopedResource()
        defer { if scoped { request.fileURL.stopAccessingSecurityScopedResource() } }
        let package = try SlopPackage(rootURL: request.fileURL)
        let reply = QLPreviewReply(fileURL: package.entryURL)
        reply.title = package.metadata.title
        return reply
    }
}
