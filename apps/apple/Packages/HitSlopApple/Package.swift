// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopApple",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "HitSlopCore", targets: ["HitSlopCore"]),
        .library(name: "HitSlopFirebase", targets: ["HitSlopFirebase"]),
        .library(name: "HitSlopRuntime", targets: ["HitSlopRuntime"]),
        .library(name: "HitSlopRegistry", targets: ["HitSlopRegistry"]),
        .library(name: "HitSlopHost", targets: ["HitSlopHost"]),
        .library(name: "HitSlopCatalog", targets: ["HitSlopCatalog"]),
        .executable(name: "hitslop-native", targets: ["HitSlopNativeCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.20"),
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", exact: "12.18.0"),
        .package(url: "https://github.com/objecthub/swift-dynamicjson.git", from: "1.0.2"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.8.2"),
    ],
    targets: [
        .target(
            name: "HitSlopCore",
            dependencies: [
                .product(name: "ZIPFoundation", package: "ZIPFoundation"),
                .product(name: "DynamicJSON", package: "swift-dynamicjson"),
            ],
            resources: [.copy("Resources/manifest.schema.json"), .copy("Resources/hitslop-document.SKILL.md")],
            linkerSettings: [.linkedLibrary("sqlite3"), .linkedFramework("ImageIO")]
        ),
        .target(
            name: "HitSlopFirebase",
            dependencies: [
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAnalytics", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAppCheck", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAI", package: "firebase-ios-sdk"),
            ]
        ),
        .target(
            name: "HitSlopRuntime",
            dependencies: ["HitSlopCore", .product(name: "DynamicJSON", package: "swift-dynamicjson")],
            resources: [.copy("Resources/host-bridge.js"), .copy("Resources/bridge-request.schema.json")],
            linkerSettings: [.linkedFramework("WebKit"), .linkedFramework("CoreServices", .when(platforms: [.macOS])), .linkedLibrary("sqlite3")]
        ),
        .target(
            name: "HitSlopRegistry",
            dependencies: [
                "HitSlopCore",
                "HitSlopFirebase",
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFunctions", package: "firebase-ios-sdk"),
            ]
        ),
        .target(
            name: "HitSlopHost",
            dependencies: ["HitSlopCore", "HitSlopRuntime"],
            linkerSettings: [.linkedFramework("AppKit"), .linkedFramework("WebKit")]
        ),
        .target(
            name: "HitSlopCatalog",
            dependencies: ["HitSlopHost", "HitSlopCore", "HitSlopRuntime", "HitSlopRegistry"],
            resources: [.process("Resources")],
            linkerSettings: [.linkedFramework("AppKit")]
        ),
        .executableTarget(
            name: "HitSlopNativeCLI",
            dependencies: [
                "HitSlopCore",
                "HitSlopHost",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ],
            linkerSettings: [.linkedFramework("AppKit")]
        ),
        .testTarget(name: "HitSlopCoreTests", dependencies: ["HitSlopCore"]),
        .testTarget(name: "HitSlopRuntimeTests", dependencies: ["HitSlopRuntime", "HitSlopCore"], resources: [.copy("Fixtures")]),
        .testTarget(name: "HitSlopHostTests", dependencies: ["HitSlopHost", "HitSlopCore"]),
        .testTarget(
            name: "HitSlopCatalogTests",
            dependencies: ["HitSlopCatalog", "HitSlopCore", "HitSlopRuntime"]
        ),
    ],
    swiftLanguageModes: [.v6]
)
