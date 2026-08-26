import QuickLookThumbnailing

final class ThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(
        for request: QLFileThumbnailRequest,
        _ handler: @escaping (QLThumbnailReply?, (any Error)?) -> Void
    ) {
        let securityScoped = request.fileURL.startAccessingSecurityScopedResource()
        defer {
            if securityScoped { request.fileURL.stopAccessingSecurityScopedResource() }
        }

        let candidates = [
            request.fileURL.appendingPathComponent("QuickLook/Thumbnail.png"),
            request.fileURL.appendingPathComponent("preview.png"),
            request.fileURL.appendingPathComponent("QuickLook/Preview.png"),
        ]
        if let url = candidates.first(where: { FileManager.default.fileExists(atPath: $0.path) }) {
            handler(QLThumbnailReply(imageFileURL: url), nil)
            return
        }

        handler(nil, nil)
    }
}
