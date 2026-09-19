# Presentation fixtures

Run `bun run presentation:fixtures`. It writes three disposable packages to a new
temporary directory and prints their paths. They are not templates and are never
registered or published. Open them using the current development build of
hitSlop, not an older installed release. Closing a fixture discards nothing valuable.

- **Standard:** authored 16px body margin remains; no host height/reset leaks in.
  Resize it and verify the button and slider still work.
- **Ellipse:** the app and both mount wrappers fill the viewport without an authored
  reset. Corners are clear. Use the toolbar to move it; the slider does not move it.
- **Washer:** fixed 320px native backing, with a 124px center hole. The top button
  and lower slider work on the band. The window cannot resize.

Put a button or text editor from another application behind the washer hole.
Click through it while the slop is active and inactive; verify the other app
receives the click. Repeat at the ellipse corners, with right-click and scroll.
A view returning nil from hitTest is not sufficient evidence. Drag the slider
outside the silhouette and release; the control must not lose its release.
Confirm the separate toolbar remains accessible and can move the window.

Export PNG/PDF: output is a dedicated 320 × 240 rectangle, not the native mask.
Icon capture: a centered ring on a transparent 512 × 512 surface. Check the top
and bottom margins are equal and no stage height causes letterboxing. After
capture, counters, slider, focus, and live window sizing must be restored.

Browser layout previews do not verify desktop click-through. Native mask unit
tests check threshold, orientation, holes, and scale independently.
