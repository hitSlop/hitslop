import AppKit
import QuickLookThumbnailing
import HitSlopSQLiteArchive

final class ThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(for request: QLFileThumbnailRequest, _ handler: @escaping (QLThumbnailReply?, (any Error)?) -> Void) {
        do {
            let db = try SQLiteArchive(url: request.fileURL)
            let png = try db.artwork("icon"); try db.close()
            guard let bitmap = NSBitmapImageRep(data: png), bitmap.pixelsWide > 0, bitmap.pixelsHigh > 0, bitmap.pixelsWide * bitmap.pixelsHigh <= 16_000_000, let image = bitmap.cgImage else { throw SQLiteFailure("Invalid icon image") }
            let edge = min(request.maximumSize.width, request.maximumSize.height)
            handler(QLThumbnailReply(contextSize: CGSize(width: edge, height: edge), drawing: { context in
                context.draw(image, in: CGRect(x: 0, y: 0, width: edge, height: edge)); return true
            }), nil)
        } catch { handler(nil, error) }
    }
}
