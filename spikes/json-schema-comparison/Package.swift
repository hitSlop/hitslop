// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "JSONSchemaComparison",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "json-schema-comparison", targets: ["Comparison"])],
    dependencies: [
        .package(url: "https://github.com/objecthub/swift-dynamicjson.git", exact: "1.0.2"),
        .package(url: "https://github.com/ajevans99/swift-json-schema.git", exact: "0.14.1"),
    ],
    targets: [
        .executableTarget(name: "Comparison", dependencies: [
            .product(name: "DynamicJSON", package: "swift-dynamicjson"),
            .product(name: "JSONSchema", package: "swift-json-schema"),
        ]),
    ]
)
