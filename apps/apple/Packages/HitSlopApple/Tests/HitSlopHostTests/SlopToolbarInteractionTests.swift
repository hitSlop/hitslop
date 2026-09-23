import AppKit
@testable import HitSlopHost
import Testing

@Test func toolbarDragRequiresFourPointsOfMovement() {
  #expect(!slopToolbarDragStarted(from: .zero, to: NSPoint(x: 2, y: 2)))
  #expect(slopToolbarDragStarted(from: .zero, to: NSPoint(x: 4, y: 0)))
  #expect(slopToolbarDragStarted(from: .zero, to: NSPoint(x: -3, y: -3)))
}

@Test func toolbarHoverRecoversAndAllowsGapCrossing() {
  var state = SlopToolbarVisibility()
  let result12 = !state.shouldShow(inside: false, interacting: false, visible: false, now: 0)
  #expect(result12)
  let result13 = state.shouldShow(inside: true, interacting: false, visible: false, now: 1)
  #expect(result13)
  let result14 = state.shouldShow(inside: false, interacting: false, visible: true, now: 2)
  #expect(result14)
  let result15 = state.shouldShow(inside: false, interacting: false, visible: true, now: 2.7)
  #expect(result15)
  let result16 = !state.shouldShow(inside: false, interacting: false, visible: true, now: 2.9)
  #expect(result16)
  let result17 = state.shouldShow(inside: true, interacting: false, visible: false, now: 3)
  #expect(result17)
  #expect(state.outsideSince == nil)
}

@Test func toolbarInteractionResetsHideDeadline() {
  var state = SlopToolbarVisibility()
  let result23 = state.shouldShow(inside: false, interacting: false, visible: true, now: 0)
  #expect(result23)
  let result24 = state.shouldShow(inside: false, interacting: true, visible: true, now: 10)
  #expect(result24)
  let result25 = state.shouldShow(inside: false, interacting: false, visible: true, now: 11)
  #expect(result25)
  let result26 = state.shouldShow(inside: false, interacting: false, visible: true, now: 11.7)
  #expect(result26)
  let result27 = !state.shouldShow(inside: false, interacting: false, visible: true, now: 11.9)
  #expect(result27)
}
