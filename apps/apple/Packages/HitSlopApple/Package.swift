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
    .library(name: "HitSlopFeatures", targets: ["HitSlopFeatures"]),
    .library(name: "HitSlopCatalog", targets: ["HitSlopCatalog"]),
    .executable(name: "hitslop-native", targets: ["HitSlopNativeCLI"]),
  ],
  dependencies: [
    .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.13.1"),
    .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.12.1"),
    .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.3.1"),
    .package(url: "https://github.com/apple/swift-http-types", from: "1.8.0"),
    .package(url: "https://github.com/pointfreeco/swift-composable-architecture", exact: "1.26.2"),
    .package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.20"),
    .package(url: "https://github.com/firebase/firebase-ios-sdk.git", exact: "12.18.0"),
    .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "10.0.0"),
    .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.8.2"),
  ],
  targets: [
    .target(name: "HitSlopWasm", dependencies: ["HitSlopCore"], resources: [.copy("Resources/runtime")], linkerSettings: [.linkedFramework("WebKit"), .linkedLibrary("sqlite3")]),
    .testTarget(name: "HitSlopWasmTests", dependencies: ["HitSlopWasm"]),
    .target(
      name: "HitSlopAPI",
      dependencies: [
        .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
        .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
        .product(name: "HTTPTypes", package: "swift-http-types"),
      ],
      plugins: [.plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")]
    ),
    .target(
      name: "HitSlopCore",
      dependencies: [
        .product(name: "ZIPFoundation", package: "ZIPFoundation"),
      ],
      linkerSettings: [.linkedFramework("ImageIO"), .linkedLibrary("sqlite3")]
    ),
    .target(
      name: "HitSlopFirebase",
      dependencies: [
        .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
        .product(name: "FirebaseAnalytics", package: "firebase-ios-sdk"),
        .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
        .product(name: "FirebaseAppCheck", package: "firebase-ios-sdk"),
        .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
      ]
    ),
    .target(
      name: "HitSlopRuntime",
      dependencies: [
        "HitSlopCore", "HitSlopAPI", "HitSlopWasm",
      ],
      exclude: ["SlopMediaSync.swift", "SlopStorage.swift", "SlopStorageWorker.swift"],
      resources: [.copy("Resources/host-bridge.js")],
      linkerSettings: [
        .linkedFramework("WebKit"), .linkedFramework("CoreServices", .when(platforms: [.macOS])),
      ]
    ),
    .target(
      name: "HitSlopRegistry",
      dependencies: [
        "HitSlopRuntime"
      ]
    ),
    .target(
      name: "HitSlopHost",
      dependencies: ["HitSlopCore", "HitSlopRuntime", "HitSlopWasm"],
      linkerSettings: [.linkedFramework("AppKit"), .linkedFramework("WebKit")]
    ),
    .target(
      name: "HitSlopFeatures",
      dependencies: [
        "HitSlopCore",
        .product(name: "ComposableArchitecture", package: "swift-composable-architecture"),
      ]),
    .testTarget(name: "HitSlopFeaturesTests", dependencies: ["HitSlopFeatures"]),
    .target(
      name: "HitSlopCatalog",
      dependencies: [
        "HitSlopHost", "HitSlopCore", "HitSlopRuntime", "HitSlopFeatures", "HitSlopFirebase",
        .product(name: "ComposableArchitecture", package: "swift-composable-architecture"),
        .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
        .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
      ],
      exclude: ["DocumentSharing.swift", "SharingInvitation.swift"],
      resources: [.process("Resources")],
      linkerSettings: [.linkedFramework("AppKit")]
    ),
    .executableTarget(
      name: "HitSlopNativeCLI",
      dependencies: [
        "HitSlopCore",
        "HitSlopHost",
        "HitSlopRuntime", "HitSlopWasm",
        .product(name: "ArgumentParser", package: "swift-argument-parser"),
      ],
      linkerSettings: [.linkedFramework("AppKit")]
    ),
    .testTarget(name: "HitSlopCoreTests", dependencies: ["HitSlopCore"]),
    .testTarget(
      name: "HitSlopRegistryTests",
      dependencies: [
        "HitSlopRegistry"
      ]),
    .testTarget(
      name: "HitSlopRuntimeTests", dependencies: ["HitSlopRuntime", "HitSlopCore"],
      resources: [.copy("Fixtures")]),
    .testTarget(name: "HitSlopHostTests", dependencies: ["HitSlopHost", "HitSlopCore", "HitSlopRuntime", "HitSlopWasm"]),
    .testTarget(
      name: "HitSlopCatalogTests",
      dependencies: ["HitSlopCatalog", "HitSlopCore", "HitSlopRuntime", "HitSlopFeatures"]
    ),
  ],
  swiftLanguageModes: [.v6]
)
