// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopHost", platforms: [.macOS(.v14)],
    products: [.library(name: "HitSlopHost", targets: ["HitSlopHost"])],
    dependencies: [.package(path: "../HitSlopCore"), .package(path: "../HitSlopRegistry")],
    targets: [.target(name: "HitSlopHost", dependencies: ["HitSlopCore", "HitSlopRegistry"], linkerSettings: [.linkedFramework("AppKit"), .linkedFramework("WebKit"), .linkedLibrary("sqlite3")])],
    swiftLanguageModes: [.v6]
)
