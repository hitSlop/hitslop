import AppKit
import HitSlopHost
import QuickLookThumbnailing

final class ThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(
        for request: QLFileThumbnailRequest,
        _ handler: @escaping (QLThumbnailReply?, (any Error)?) -> Void
    ) {
        let url = request.fileURL
        nonisolated(unsafe) let complete = handler
        Task {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                let png = try await SlopRenderer.pngData(packageURL: url)
                let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("png")
                try png.write(to: file)
                complete(QLThumbnailReply(imageFileURL: file), nil)
            } catch {
                complete(nil, error)
            }
        }
    }
}
