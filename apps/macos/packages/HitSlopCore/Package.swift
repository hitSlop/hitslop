// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopCore",
    platforms: [.macOS(.v14)],
    products: [.library(name: "HitSlopCore", targets: ["HitSlopCore"])],
    dependencies: [.package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.20")],
    targets: [
        .target(name: "HitSlopCore", dependencies: ["ZIPFoundation"], linkerSettings: [.linkedLibrary("sqlite3"), .linkedFramework("ImageIO")]),
        .testTarget(name: "HitSlopCoreTests", dependencies: ["HitSlopCore"]),
    ],
    swiftLanguageModes: [.v6]
)
