// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopRegistry", platforms: [.macOS(.v14), .iOS(.v17)],
    products: [.library(name: "HitSlopRegistry", targets: ["HitSlopRegistry"])],
    dependencies: [.package(url: "https://github.com/get-convex/convex-swift.git", from: "0.8.1")],
    targets: [.target(name: "HitSlopRegistry", dependencies: [.product(name: "ConvexMobile", package: "convex-swift")])],
    swiftLanguageModes: [.v6]
)
