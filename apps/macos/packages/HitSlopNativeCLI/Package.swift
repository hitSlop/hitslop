// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HitSlopNativeCLI", platforms: [.macOS(.v14)],
    products: [.executable(name: "hitslop-native", targets: ["HitSlopNativeCLI"])],
    dependencies: [
        .package(path: "../HitSlopCore"), .package(path: "../HitSlopHost"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.8.2"),
    ],
    targets: [.executableTarget(name: "HitSlopNativeCLI", dependencies: ["HitSlopCore", "HitSlopHost", .product(name: "ArgumentParser", package: "swift-argument-parser")], linkerSettings: [.linkedFramework("AppKit")])],
    swiftLanguageModes: [.v6]
)
