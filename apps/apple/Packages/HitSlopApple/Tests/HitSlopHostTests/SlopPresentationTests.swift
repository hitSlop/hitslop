import AppKit
import Foundation
import Testing
import HitSlopHost

@Test @MainActor func presentationFixturesExportWithoutNativeMaskAndRenderSquareIcons() async throws {
    guard let source = ProcessInfo.processInfo.environment["HITSLOP_PRESENTATION_FIXTURES"] else { return }
    let paths = try JSONDecoder().decode([String: String].self, from: Data(source.utf8))
    #expect(Set(paths.keys) == Set(["standard", "ellipse", "washer"]))
    for path in paths.values {
        let url = URL(fileURLWithPath: path)
        let exported = try await SlopRenderer.exportPNGData(packageURL: url)
        let bitmap = try #require(NSBitmapImageRep(data: exported))
        #expect(bitmap.pixelsWide == 640)
        #expect(bitmap.pixelsHigh == 480)
        // Dedicated export corners remain opaque even for an ellipse or holed skin.
        #expect((bitmap.colorAt(x: 2, y: 2)?.alphaComponent ?? 0) > 0.99)
        let icon = try #require(await SlopRenderer.targetPNGData(packageURL: url, target: .icon))
        let image = try #require(NSBitmapImageRep(data: icon))
        #expect(image.pixelsWide == 512)
        #expect(image.pixelsHigh == 512)
        #expect((image.colorAt(x: 256, y: 256)?.alphaComponent ?? 1) == 0)
        #expect((image.colorAt(x: 256, y: 80)?.alphaComponent ?? 0) > 0.99)
        #expect((image.colorAt(x: 256, y: 431)?.alphaComponent ?? 0) > 0.99)
        #expect((image.colorAt(x: 256, y: 30)?.alphaComponent ?? 1) == 0)
    }
}
