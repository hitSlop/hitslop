import HitSlopMac
import SwiftUI

@main
struct hitSlopApp: App {
    @NSApplicationDelegateAdaptor(HitSlopApplicationDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            VStack(spacing: 8) {
                Text("hitSlop").font(.headline)
                Text("ElementaryUI apps whose source and data live beside them.")
                    .foregroundStyle(.secondary)
            }
            .frame(width: 380)
            .padding(28)
        }
    }
}
