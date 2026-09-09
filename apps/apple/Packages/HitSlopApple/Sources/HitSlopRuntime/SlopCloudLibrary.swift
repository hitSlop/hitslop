import Foundation
import HitSlopCore

@MainActor public final class SlopCloudLibrary: NSObject, ObservableObject {
    @Published public private(set) var documents: [URL] = []
    @Published public private(set) var iCloudAvailable: Bool
    @Published public private(set) var status: String?
    private let query = NSMetadataQuery()
    private var queryStarted = false

    public override init() {
        iCloudAvailable = SlopCloud.isAvailable
        super.init()
        query.predicate = NSPredicate(format: "%K ENDSWITH[c] %@", NSMetadataItemFSNameKey, ".slop")
        query.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]
        query.operationQueue = .main
        NotificationCenter.default.addObserver(self, selector: #selector(queryDidChange), name: .NSMetadataQueryDidFinishGathering, object: query)
        NotificationCenter.default.addObserver(self, selector: #selector(queryDidChange), name: .NSMetadataQueryDidUpdate, object: query)
        refresh()
    }

    public func refresh() {
        iCloudAvailable = SlopCloud.isAvailable
        if iCloudAvailable {
            status = nil
            if !queryStarted { query.start(); queryStarted = true }
        } else {
            status = "Sign in to iCloud to sync slops with Mac."
            if queryStarted { query.stop(); queryStarted = false }
        }
        merge(queryURLs() + localURLs() + iCloudDirectoryURLs())
    }

    @objc private func queryDidChange() {
        query.disableUpdates()
        defer { query.enableUpdates() }
        merge(queryURLs() + localURLs() + iCloudDirectoryURLs())
    }

    private func queryURLs() -> [URL] {
        (0..<query.resultCount).compactMap { index in
            guard let item = query.result(at: index) as? NSMetadataItem else { return nil }
            return item.value(forAttribute: NSMetadataItemURLKey) as? URL
        }
    }

    private func iCloudDirectoryURLs() -> [URL] {
        guard let directory = SlopCloud.documentsURL else { return [] }
        return slopPackages(in: directory)
    }

    private func localURLs() -> [URL] {
        #if os(iOS)
        slopPackages(in: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0])
        #else
        []
        #endif
    }

    private func slopPackages(in directory: URL) -> [URL] {
        (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles]))?
            .filter { $0.pathExtension.lowercased() == "slop" } ?? []
    }

    private func merge(_ urls: [URL]) {
        var seen = Set<String>()
        var next: [URL] = []
        for url in urls {
            let standardized = url.standardizedFileURL
            try? FileManager.default.startDownloadingUbiquitousItem(at: standardized)
            let key = standardized.path
            guard seen.insert(key).inserted else { continue }
            next.append(standardized)
        }
        documents = next.sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
    }
}
