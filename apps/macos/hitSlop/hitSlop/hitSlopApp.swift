import HitSlopHost
import SwiftUI

@main
struct hitSlopApp: App {
    @State private var openDocument: URL?

    private var deploymentURL: String { Bundle.main.object(forInfoDictionaryKey: "ConvexDeploymentURL") as? String ?? "https://giddy-opossum-593.convex.cloud" }
    private var catalogURL: URL { URL(string: Bundle.main.object(forInfoDictionaryKey: "CatalogURL") as? String ?? "http://localhost:3000")! }

    var body: some Scene {
        WindowGroup {
            Group {
                if let openDocument { SlopDocumentView(packageURL: openDocument).navigationTitle(openDocument.deletingPathExtension().lastPathComponent) }
                else { CatalogView(deploymentURL: deploymentURL, catalogURL: catalogURL) }
            }
            .onOpenURL { openDocument = $0 }
            .frame(minWidth: 760, minHeight: 560)
        }
    }
}
