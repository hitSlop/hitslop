// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopHost", platforms: [.macOS(.v14)],
    products: [
        .library(name: "HitSlopHost", targets: ["HitSlopHost"]),
        .library(name: "HitSlopCatalog", targets: ["HitSlopCatalog"]),
    ],
    dependencies: [.package(path: "../HitSlopCore"), .package(path: "../HitSlopRegistry")],
    targets: [
        .target(name: "HitSlopHost", dependencies: ["HitSlopCore"], linkerSettings: [.linkedFramework("AppKit"), .linkedFramework("WebKit"), .linkedLibrary("sqlite3")]),
        .target(name: "HitSlopCatalog", dependencies: ["HitSlopHost", "HitSlopRegistry"], linkerSettings: [.linkedFramework("AppKit")]),
    ],
    swiftLanguageModes: [.v6]
)
