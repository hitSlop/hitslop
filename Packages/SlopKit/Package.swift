// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SlopKit",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "SlopCore", targets: ["SlopCore"]),
        .library(name: "SlopWebRuntime", targets: ["SlopWebRuntime"]),
    ],
    targets: [
        .target(
            name: "SlopCore",
            resources: [.copy("Resources/AgentSkill")],
            linkerSettings: [.linkedLibrary("sqlite3")]
        ),
        .target(
            name: "SlopWebRuntime",
            dependencies: ["SlopCore"],
            resources: [.process("Resources")],
            linkerSettings: [.linkedFramework("WebKit")]
        ),
        .testTarget(
            name: "SlopCoreTests",
            dependencies: ["SlopCore"],
            resources: [.copy("Fixtures")]
        ),
    ],
    swiftLanguageModes: [.v5]
)
