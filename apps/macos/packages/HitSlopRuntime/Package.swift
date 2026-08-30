// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopRuntime",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [.library(name: "HitSlopRuntime", targets: ["HitSlopRuntime"])],
    dependencies: [.package(path: "../HitSlopCore")],
    targets: [
        .target(name: "HitSlopRuntime", dependencies: ["HitSlopCore"], linkerSettings: [.linkedFramework("WebKit"), .linkedLibrary("sqlite3")]),
        .testTarget(name: "HitSlopRuntimeTests", dependencies: ["HitSlopRuntime", "HitSlopCore"]),
    ],
    swiftLanguageModes: [.v6]
)
