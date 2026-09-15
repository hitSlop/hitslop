import Foundation
import Testing
@testable import HitSlopCatalog

@Test func sharingInvitationRequiresExactNativeRouteAndToken() throws {
    let token = String(repeating: "a", count: 64)
    let valid = try #require(SharingInvitation(url: URL(string: "hitslop://join/abc-123#\(token)")!))
    #expect(valid.roomId == "abc-123")
    #expect(valid.token == token)
    for string in ["https://join/abc#\(token)", "hitslop://join/abc", "hitslop://join/abc#bad", "hitslop://other/abc#\(token)", "hitslop://join/abc/extra#\(token)", "hitslop://join/abc?token=secret#\(token)", "hitslop://user@join/abc#\(token)"] {
        #expect(SharingInvitation(url: URL(string: string)!) == nil)
    }
}

import AppKit
import ComposableArchitecture
import HitSlopCore
import HitSlopFeatures
import HitSlopHost

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"] != nil))
@MainActor func sharingCommandOpensNativePanel() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"]!)
    let document = FileManager.default.temporaryDirectory.appendingPathComponent("sharing-panel-\(UUID().uuidString).slop")
    try SlopDuplicator.duplicate(from: source, to: document)
    defer { try? FileManager.default.removeItem(at: document) }
    let controller = try SlopDocumentWindowController(packageURL: document)
    try await controller.session.waitUntilReady()
    let account = Store(initialState: AccountFeature.State()) { AccountFeature() } withDependencies: { $0.accountClient = .empty }
    let model = DocumentSharing(controller: controller, account: account)
    defer {
        model.stop()
        controller.window?.delegate = nil
        controller.session.close()
        for child in controller.window?.childWindows ?? [] { child.close() }
        controller.window?.close()
    }
    controller.onShare = { model.show() }
    _ = try await controller.perform(.share)
    let panel = try #require(controller.window?.childWindows?.first { $0.title == "Share" })
    #expect(panel.contentViewController != nil)
    if let output = ProcessInfo.processInfo.environment["HITSLOP_SHARE_PANEL_OUTPUT"], let view = panel.contentView,
       let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
        view.cacheDisplay(in: view.bounds, to: bitmap)
        try bitmap.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: output))
    }
}
