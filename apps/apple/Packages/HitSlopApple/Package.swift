// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "HitSlopApple",
  platforms: [.macOS(.v14), .iOS(.v17)],
  products: [
    .library(name: "HitSlopCore", targets: ["HitSlopCore"]),
    .library(name: "HitSlopFirebase", targets: ["HitSlopFirebase"]),
    .library(name: "HitSlopRuntime", targets: ["HitSlopRuntime"]),
    .library(name: "HitSlopHost", targets: ["HitSlopHost"]),
    .library(name: "HitSlopFeatures", targets: ["HitSlopFeatures"]),
    .library(name: "HitSlopCatalog", targets: ["HitSlopCatalog"]),
    .executable(name: "hitslop-native", targets: ["HitSlopNativeCLI"]),
  ],
  dependencies: [
    .package(url: "https://github.com/pointfreeco/swift-composable-architecture", exact: "1.26.2"),
    .package(url: "https://github.com/firebase/firebase-ios-sdk.git", exact: "12.18.0"),
    .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.8.2"),
  ],
  targets: [
    .target(name: "HitSlopWasm", dependencies: ["HitSlopCore"], resources: [.copy("Resources/runtimes")], linkerSettings: [.linkedFramework("WebKit"), .linkedLibrary("sqlite3")]),
    .testTarget(name: "HitSlopWasmTests", dependencies: ["HitSlopWasm"]),
    .target(
      name: "HitSlopCore",
      linkerSettings: [.linkedFramework("ImageIO"), .linkedLibrary("sqlite3")]
    ),
    .target(
      name: "HitSlopFirebase",
      dependencies: [
        "HitSlopCore",
        .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
        .product(name: "FirebaseAnalytics", package: "firebase-ios-sdk"),
        .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
      ]
    ),
    .target(
      name: "HitSlopRuntime",
      dependencies: [
        "HitSlopCore", "HitSlopWasm",
      ],
      resources: [.copy("Resources/host-bridge.js")],
      linkerSettings: [
        .linkedFramework("WebKit"), .linkedFramework("CoreServices", .when(platforms: [.macOS])),
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
      ],
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
      name: "HitSlopRuntimeTests", dependencies: ["HitSlopRuntime", "HitSlopCore"]),
    .testTarget(name: "HitSlopHostTests", dependencies: ["HitSlopHost", "HitSlopCore", "HitSlopRuntime", "HitSlopWasm"]),
    .testTarget(
      name: "HitSlopCatalogTests",
      dependencies: ["HitSlopCatalog", "HitSlopCore", "HitSlopRuntime", "HitSlopFeatures"]
    ),
  ],
  swiftLanguageModes: [.v6]
)
