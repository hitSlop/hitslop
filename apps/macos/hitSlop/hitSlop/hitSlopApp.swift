import HitSlopCatalog
import HitSlopHost
import SwiftUI

@main
struct hitSlopApp: App {
    private var deploymentURL: String {
        Bundle.main.object(forInfoDictionaryKey: "ConvexDeploymentURL") as? String ?? Self.defaultDeploymentURL
    }
    private var catalogURL: URL {
        URL(string: Bundle.main.object(forInfoDictionaryKey: "CatalogURL") as? String ?? Self.defaultCatalogURL)!
    }

    #if DEBUG
    private static let defaultDeploymentURL = "https://giddy-opossum-593.convex.cloud"
    private static let defaultCatalogURL = "http://localhost:3000"
    #else
    private static let defaultDeploymentURL = "https://fastidious-malamute-777.convex.cloud"
    private static let defaultCatalogURL = "https://hitslop.app"
    #endif

    var body: some Scene {
        WindowGroup("hitSlop", id: "catalog") {
            CatalogView(deploymentURL: deploymentURL, catalogURL: catalogURL)
                .frame(minWidth: 760, minHeight: 560)
        }
        WindowGroup("Slop", id: "slop-document", for: URL.self) { $url in
            if let url {
                SlopWindowScene(packageURL: url)
            }
        }
        .windowResizability(.contentSize)
    }
}
