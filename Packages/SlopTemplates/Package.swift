// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SlopTemplates",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "SlopTemplates", targets: ["SlopTemplates"]),
    ],
    dependencies: [.package(path: "../SlopKit")],
    targets: [
        .target(
            name: "SlopTemplates",
            dependencies: [
                .product(name: "SlopCore", package: "SlopKit"),
            ],
            resources: [
                .copy("Resources/Templates"),
                .copy("Resources/Themes"),
            ]
        ),
        .testTarget(
            name: "SlopTemplatesTests",
            dependencies: [
                "SlopTemplates",
                .product(name: "SlopCore", package: "SlopKit"),
            ]
        ),
    ],
    swiftLanguageModes: [.v5]
)
