import AppKit
@testable import HitSlopHost
import Testing

@Test @MainActor func toolbarDragHandleForwardsMouseDownEvent() throws {
    var receivedEventNumber: Int?
    let handle = SlopToolbarDragHandleView { receivedEventNumber = $0.eventNumber }
    let event = try #require(NSEvent.mouseEvent(
        with: .leftMouseDown,
        location: NSPoint(x: 8, y: 8),
        modifierFlags: [],
        timestamp: 0,
        windowNumber: 0,
        context: nil,
        eventNumber: 42,
        clickCount: 1,
        pressure: 1
    ))

    handle.mouseDown(with: event)

    #expect(receivedEventNumber == 42)
}
