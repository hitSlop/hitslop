// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopHost", platforms: [.macOS(.v14)],
    products: [
        .library(name: "HitSlopHost", targets: ["HitSlopHost"]),
        .library(name: "HitSlopCatalog", targets: ["HitSlopCatalog"]),
    ],
    dependencies: [.package(path: "../../../../packages/apple")],
    targets: [
        .target(name: "HitSlopHost", dependencies: [.product(name: "HitSlopCore", package: "apple"), .product(name: "HitSlopRuntime", package: "apple")], linkerSettings: [.linkedFramework("AppKit"), .linkedFramework("WebKit")]),
        .target(name: "HitSlopCatalog", dependencies: ["HitSlopHost", .product(name: "HitSlopCore", package: "apple"), .product(name: "HitSlopRuntime", package: "apple"), .product(name: "HitSlopRegistry", package: "apple")], linkerSettings: [.linkedFramework("AppKit")]),
        .testTarget(name: "HitSlopHostTests", dependencies: ["HitSlopHost", .product(name: "HitSlopCore", package: "apple")]),
        .testTarget(name: "HitSlopCatalogTests", dependencies: ["HitSlopCatalog", .product(name: "HitSlopCore", package: "apple"), .product(name: "HitSlopRuntime", package: "apple")]),
    ],
    swiftLanguageModes: [.v6]
)
