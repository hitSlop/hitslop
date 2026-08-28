// swift-tools-version: 6.3
import CompilerPluginSupport
import PackageDescription

let package = Package(
    name: "SlopGuest",
    platforms: [.macOS(.v15)],
    products: [
        .library(name: "SlopKit", targets: ["SlopKit"]),
    ],
    dependencies: [
        .package(url: "https://github.com/elementary-swift/elementary-ui.git", exact: "0.7.0"),
        .package(url: "https://github.com/swiftwasm/JavaScriptKit.git", exact: "0.58.0"),
        .package(url: "https://github.com/swiftlang/swift-syntax", exact: "603.0.2"),
    ],
    targets: [
        .target(
            name: "SlopKit",
            dependencies: [
                .target(name: "SlopMacros"),
                .product(name: "ElementaryUI", package: "elementary-ui"),
                .product(name: "JavaScriptKit", package: "JavaScriptKit"),
            ],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .macro(
            name: "SlopMacros",
            dependencies: [
                .product(name: "SwiftCompilerPlugin", package: "swift-syntax"),
                .product(name: "SwiftSyntax", package: "swift-syntax"),
                .product(name: "SwiftSyntaxBuilder", package: "swift-syntax"),
                .product(name: "SwiftSyntaxMacros", package: "swift-syntax"),
            ]
        ),
        .testTarget(
            name: "SlopKitTests",
            dependencies: ["SlopKit"]
        ),
    ],
    swiftLanguageModes: [.v5]
)
