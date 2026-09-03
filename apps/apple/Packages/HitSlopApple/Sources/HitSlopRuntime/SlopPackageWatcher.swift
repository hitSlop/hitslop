#if os(macOS)
import CoreServices
import Foundation

/// Recursive macOS package watcher. Events are only wake-up signals; callers
/// still compare canonical store revisions before notifying the guest.
final class SlopPackageWatcher: @unchecked Sendable {
    private var stream: FSEventStreamRef?
    private let queue = DispatchQueue(label: "app.hitslop.package-watcher", qos: .utility)
    private let onChange: @Sendable () -> Void

    init(packageURL: URL, onChange: @escaping @Sendable () -> Void) {
        self.onChange = onChange
        var context = FSEventStreamContext(
            version: 0,
            info: Unmanaged.passUnretained(self).toOpaque(),
            retain: nil,
            release: nil,
            copyDescription: nil
        )
        let callback: FSEventStreamCallback = { _, info, _, _, _, _ in
            guard let info else { return }
            Unmanaged<SlopPackageWatcher>.fromOpaque(info).takeUnretainedValue().onChange()
        }
        let flags = FSEventStreamCreateFlags(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer)
        stream = FSEventStreamCreate(
            nil,
            callback,
            &context,
            [packageURL.path] as CFArray,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
            0.05,
            flags
        )
        guard let stream else { return }
        FSEventStreamSetDispatchQueue(stream, queue)
        FSEventStreamStart(stream)
    }

    func stop() {
        guard let stream else { return }
        FSEventStreamStop(stream)
        FSEventStreamInvalidate(stream)
        FSEventStreamRelease(stream)
        self.stream = nil
    }

    deinit { stop() }
}
#endif
