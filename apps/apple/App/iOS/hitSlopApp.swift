import SwiftUI

@main struct HitSlopApp: App {
    var body: some Scene {
        WindowGroup {
            ContentUnavailableView("Use hitSlop on Mac", systemImage: "desktopcomputer", description: Text("Document editing is currently available on macOS."))
        }
    }
}
