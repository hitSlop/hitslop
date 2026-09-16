// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopApple",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .executable(name: "hitslop-collections-spike", targets: ["HitSlopCollectionsSpikeCLI"]),
        .library(name: "HitSlopSQLiteArchive", targets: ["HitSlopSQLiteArchive"]),
        .library(name: "HitSlopSQLiteSpikeHost", targets: ["HitSlopSQLiteSpikeHost"]),
        .executable(name: "hitslop-sqlite-spike", targets: ["HitSlopSQLiteSpikeCLI"]),
        .library(name: "HitSlopCore", targets: ["HitSlopCore"]),
        .library(name: "HitSlopFirebase", targets: ["HitSlopFirebase"]),
        .library(name: "HitSlopRuntime", targets: ["HitSlopRuntime"]),
        .library(name: "HitSlopRegistry", targets: ["HitSlopRegistry"]),
        .library(name: "HitSlopHost", targets: ["HitSlopHost"]),
        .library(name: "HitSlopCatalog", targets: ["HitSlopCatalog"]),
        .executable(name: "hitslop-native", targets: ["HitSlopNativeCLI"]),
        .executable(name: "hitslop-loro-spike", targets: ["HitSlopLoroSpikeCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/loro-dev/loro-swift.git", exact: "1.13.3"),
        .package(url: "https://github.com/pointfreeco/swift-composable-architecture", exact: "1.26.2"),
        .package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.20"),
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", exact: "12.18.0"),
        .package(url: "https://github.com/google/GoogleSignIn-iOS", exact: "9.0.0"),
        .package(url: "https://github.com/objecthub/swift-dynamicjson.git", from: "1.0.2"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.8.2"),
    ],
    targets: [
        .target(name: "HitSlopCollectionsSpike", dependencies: ["HitSlopSQLiteArchive", "HitSlopLoroSpike", .product(name: "Loro", package: "loro-swift")]),
        .executableTarget(name: "HitSlopCollectionsSpikeCLI", dependencies: ["HitSlopCollectionsSpike", "HitSlopSQLiteArchive"], linkerSettings: [.linkedFramework("AppKit"), .linkedFramework("WebKit")]),
        .testTarget(name: "HitSlopCollectionsSpikeTests", dependencies: ["HitSlopCollectionsSpike", "HitSlopSQLiteArchive", "HitSlopLoroSpike"], resources: [.copy("Fixtures")]),
        .target(name: "HitSlopSQLiteArchive", linkerSettings: [.linkedLibrary("sqlite3")]),
        .target(name: "HitSlopSQLiteSpike", dependencies: ["HitSlopSQLiteArchive", "HitSlopLoroSpike"]),
        .target(name: "HitSlopSQLiteSpikeHost", dependencies: ["HitSlopSQLiteSpike", "HitSlopSQLiteArchive"], linkerSettings: [.linkedFramework("AppKit"), .linkedFramework("WebKit")]),
        .executableTarget(name: "HitSlopSQLiteSpikeCLI", dependencies: ["HitSlopSQLiteSpikeHost", "HitSlopSQLiteSpike", "HitSlopSQLiteArchive"]),
        .testTarget(name: "HitSlopSQLiteSpikeTests", dependencies: ["HitSlopSQLiteSpike", "HitSlopSQLiteArchive"]),
        .target(name: "HitSlopLoroSpike", dependencies: ["HitSlopCore", "HitSlopRuntime", .product(name: "Loro", package: "loro-swift"), .product(name: "DynamicJSON", package: "swift-dynamicjson")]),
        .executableTarget(name: "HitSlopLoroSpikeCLI", dependencies: ["HitSlopLoroSpike", "HitSlopRuntime", "HitSlopCore"], linkerSettings: [.linkedFramework("AppKit")]),
        .testTarget(name: "HitSlopLoroSpikeTests", dependencies: ["HitSlopLoroSpike", "HitSlopRuntime", .product(name: "Loro", package: "loro-swift")], resources: [.copy("Fixtures")]),
        .target(name: "HitSlopFeatures", dependencies: [
            "HitSlopCore", .product(name: "ComposableArchitecture", package: "swift-composable-architecture"),
        ]),
        .testTarget(name: "HitSlopFeaturesTests", dependencies: ["HitSlopFeatures"]),
        .target(
            name: "HitSlopCore",
            dependencies: [
                .product(name: "ZIPFoundation", package: "ZIPFoundation"),
                .product(name: "DynamicJSON", package: "swift-dynamicjson"),
            ],
            resources: [.copy("Resources/manifest.schema.json"), .copy("Resources/hitslop-document.SKILL.md"), .copy("Resources/skills")],
            linkerSettings: [.linkedFramework("ImageIO")]
        ),
        .target(
            name: "HitSlopFirebase",
            dependencies: [
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAnalytics", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAppCheck", package: "firebase-ios-sdk"),
            ]
        ),
        .target(
            name: "HitSlopRuntime",
            dependencies: ["HitSlopCore", .product(name: "DynamicJSON", package: "swift-dynamicjson")],
            resources: [.copy("Resources/host-bridge.js"), .copy("Resources/document-runtimes"), .copy("Resources/bridge-request.schema.json")],
            linkerSettings: [.linkedFramework("WebKit"), .linkedFramework("CoreServices", .when(platforms: [.macOS]))]
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
            dependencies: ["HitSlopHost", "HitSlopCore", "HitSlopRuntime", "HitSlopRegistry", "HitSlopFirebase", "HitSlopFeatures",
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFunctions", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAppCheck", package: "firebase-ios-sdk"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
                .product(name: "GoogleSignInSwift", package: "GoogleSignIn-iOS"),
            ],
            resources: [.process("Resources")],
            linkerSettings: [.linkedFramework("AppKit")]
        ),
        .executableTarget(
            name: "HitSlopNativeCLI",
            dependencies: [
                "HitSlopCore",
                "HitSlopHost",
                "HitSlopRuntime",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ],
            linkerSettings: [.linkedFramework("AppKit")]
        ),
        .testTarget(name: "HitSlopCoreTests", dependencies: ["HitSlopCore"]),
        .testTarget(name: "HitSlopRegistryTests", dependencies: [
            "HitSlopRegistry",
            .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
        ]),
        .testTarget(name: "HitSlopRuntimeTests", dependencies: ["HitSlopRuntime", "HitSlopCore"], resources: [.copy("Fixtures")]),
        .testTarget(name: "HitSlopHostTests", dependencies: ["HitSlopHost", "HitSlopCore"]),
        .testTarget(
            name: "HitSlopCatalogTests",
            dependencies: ["HitSlopCatalog", "HitSlopCore", "HitSlopRuntime"]
        ),
    ],
    swiftLanguageModes: [.v6]
)
