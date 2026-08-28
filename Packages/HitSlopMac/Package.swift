// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopMac",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "SlopMacSupport", targets: ["SlopMacSupport"]),
        .library(name: "HitSlopMac", targets: ["HitSlopMac"]),
    ],
    dependencies: [.package(path: "../SlopKit")],
    targets: [
        .target(
            name: "SlopMacSupport",
            dependencies: [
                .product(name: "SlopCore", package: "SlopKit"),
                .product(name: "SlopWebRuntime", package: "SlopKit"),
            ],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("WebKit"),
            ]
        ),
        .target(
            name: "HitSlopMac",
            dependencies: [
                "SlopMacSupport",
                .product(name: "SlopCore", package: "SlopKit"),
                .product(name: "SlopWebRuntime", package: "SlopKit"),
            ],
            resources: [
                .copy("Resources/Templates"),
                .copy("Resources/Themes"),
            ],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("WebKit"),
            ]
        ),
        .testTarget(
            name: "SlopMacSupportTests",
            dependencies: ["SlopMacSupport", .product(name: "SlopCore", package: "SlopKit")]
        ),
    ],
    swiftLanguageModes: [.v5]
)
