import QuickLookThumbnailing
import AppKit
import HitSlopCore

final class ThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(
        for request: QLFileThumbnailRequest,
        _ handler: @escaping (QLThumbnailReply?, (any Error)?) -> Void
    ) {
        let scoped = request.fileURL.startAccessingSecurityScopedResource()
        defer { if scoped { request.fileURL.stopAccessingSecurityScopedResource() } }
        do {
            let package = try SlopPackage(rootURL: request.fileURL)
            let reply = QLThumbnailReply(contextSize: request.maximumSize) { context in
                NSColor.windowBackgroundColor.setFill(); context.fill(CGRect(origin: .zero, size: request.maximumSize))
                let title = package.metadata.title as NSString
                title.draw(at: CGPoint(x: 18, y: request.maximumSize.height / 2 - 12), withAttributes: [.font: NSFont.systemFont(ofSize: 24, weight: .semibold), .foregroundColor: NSColor.labelColor])
                return true
            }
            handler(reply, nil)
        } catch { handler(nil, error) }
    }
}
