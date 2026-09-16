import AppKit
import QuickLookUI
import UniformTypeIdentifiers
import HitSlopSQLiteArchive

final class PreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(for request: QLFilePreviewRequest, completionHandler handler: @escaping (QLPreviewReply?, (any Error)?) -> Void) {
        do {
            let db = try SQLiteArchive(url: request.fileURL)
            let png = try db.artwork("preview"); try db.close()
            guard let bitmap = NSBitmapImageRep(data: png), bitmap.pixelsWide > 0, bitmap.pixelsHigh > 0, bitmap.pixelsWide * bitmap.pixelsHigh <= 16_000_000 else { throw SQLiteFailure("Invalid preview image") }
            let size = NSSize(width: bitmap.pixelsWide, height: bitmap.pixelsHigh)
            let reply = QLPreviewReply(dataOfContentType: .png, contentSize: size) { _ in png }
            handler(reply, nil)
        } catch { handler(nil, error) }
    }
}
