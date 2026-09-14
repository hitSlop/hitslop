import Foundation
import HitSlopCore
import HitSlopFeatures
import HitSlopRuntime
import Testing
@testable import HitSlopCatalog

/// Opt-in comparison with the previous synchronous recents adapter, using disposable packages.
@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_RUN_CATALOG_BENCHMARK"] == "1"))
@MainActor func catalogPerformance() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-catalog-benchmark-\(UUID())")
    defer { try? FileManager.default.removeItem(at: root) }
    let urls = try (1...100).map { index in
        let url = try coordinatorFixture(in: root, index: index)
        let assets = url.appendingPathComponent("assets")
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        for asset in 0..<128 { try Data(repeating: 65, count: 256).write(to: assets.appendingPathComponent("asset-\(asset)")) }
        return url
    }
    let scanner = CatalogScanner()
    let templates = root.appendingPathComponent("templates")
    for trial in 1...5 {
        for background in trial.isMultiple(of: 2) ? [true, false] : [false, true] {
            var intervals: [Double] = []
            var previous = ContinuousClock.now
            let heartbeat = Task { @MainActor in
                while !Task.isCancelled {
                    try await Task.sleep(for: .milliseconds(1))
                    let now = ContinuousClock.now
                    intervals.append(milliseconds(now - previous))
                    previous = now
                }
            }
            try await Task.sleep(for: .milliseconds(5))
            let start = ContinuousClock.now
            let entries: [CatalogEntry]
            if background { entries = try await scanner.recents(urls, templatesRoot: templates) }
            else { entries = synchronousRecents(urls, templatesRoot: templates) }
            let elapsed = milliseconds(ContinuousClock.now - start)
            try await Task.sleep(for: .milliseconds(5))
            heartbeat.cancel()
            _ = try? await heartbeat.value
            #expect(entries.count == urls.count)
            #expect(entries.allSatisfy { $0.packageBytes >= 128 * 256 })
            let result: [String: Any] = [
                "variant": background ? "background" : "previous_main_actor", "trial": trial,
                "documents": urls.count, "scan_ms": elapsed, "max_main_actor_interval_ms": intervals.max() ?? 0
            ]
            let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
            print("HITSLOP_CATALOG_BENCHMARK " + String(decoding: data, as: UTF8.self))
        }
    }
}

/// The adapter before the follow-up: synchronous filesystem reads on MainActor.
@MainActor private func synchronousRecents(_ urls: [URL], templatesRoot: URL) -> [CatalogEntry] {
    urls.filter {
        $0.pathExtension.lowercased() == "slop" && FileManager.default.fileExists(atPath: $0.path)
            && !DocumentFactory.isManagedTemplatePackage($0, templatesRoot: templatesRoot)
    }.map { url in
        let package = try? SlopPackage(rootURL: url)
        var entry = CatalogEntry(id: "recent:\(url.standardizedFileURL.path)", source: .recent(url), title: package?.manifest.title ?? url.deletingPathExtension().lastPathComponent)
        if let package {
            CatalogServices.apply(package.manifest, to: &entry)
            entry.iconURLs = [package.iconURL, package.previewURL]
            entry.previewURLs = [package.previewURL, package.iconURL]
        }
        entry.packageBytes = slopPackageByteCount(url)
        let values = try? url.resourceValues(forKeys: [.creationDateKey, .contentModificationDateKey])
        entry.createdAt = values?.creationDate; entry.updatedAt = values?.contentModificationDate
        return entry
    }
}

private func milliseconds(_ duration: Duration) -> Double {
    Double(duration.components.seconds) * 1_000 + Double(duration.components.attoseconds) / 1e15
}
