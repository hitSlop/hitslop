// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "hitSlop",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "SlopCore", targets: ["SlopCore"]),
        .executable(name: "slop", targets: ["slop"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.8.2"),
        .package(url: "https://github.com/kylehowells/swift-justhtml.git", from: "0.4.6"),
    ],
    targets: [
        .target(
            name: "SlopCore",
            dependencies: [
                .product(name: "justhtml", package: "swift-justhtml"),
            ],
            path: "Shared",
            linkerSettings: [
                .linkedLibrary("sqlite3"),
                .linkedFramework("AppKit"),
            ]
        ),
        .executableTarget(
            name: "slop",
            dependencies: [
                "SlopCore",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ],
            path: "CLI",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("WebKit"),
            ]
        ),
        .testTarget(
            name: "SlopCoreTests",
            dependencies: ["SlopCore"],
            path: "Tests"
        ),
    ]
)
