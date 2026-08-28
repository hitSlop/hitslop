import QuickLookThumbnailing
import SlopMacSupport

final class ThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(
        for request: QLFileThumbnailRequest,
        _ handler: @escaping (QLThumbnailReply?, (any Error)?) -> Void
    ) {
        let scoped = request.fileURL.startAccessingSecurityScopedResource()
        defer { if scoped { request.fileURL.stopAccessingSecurityScopedResource() } }
        guard let url = SlopPreviewAssets.thumbnailURL(in: request.fileURL) else {
            handler(nil, nil)
            return
        }
        handler(QLThumbnailReply(imageFileURL: url), nil)
    }
}
