// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SlopCLI",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "slop", targets: ["SlopCLI"])],
    dependencies: [
        .package(path: "../SlopKit"),
        .package(path: "../HitSlopMac"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.5.0"),
    ],
    targets: [
        .executableTarget(
            name: "SlopCLI",
            dependencies: [
                .product(name: "SlopCore", package: "SlopKit"),
                .product(name: "SlopMacSupport", package: "HitSlopMac"),
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ],
            linkerSettings: [.linkedFramework("AppKit")]
        ),
    ],
    swiftLanguageModes: [.v5]
)
