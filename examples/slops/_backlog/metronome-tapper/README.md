# Metronome & BPM

A smoked mahogany studio metronome with a swinging brass pendulum, woodblock clicks, tap tempo, and saved presets.

Features:
- Animated pendulum whose swing tracks BPM (frozen under reduced motion)
- Web Audio woodblock / rimshot clicks with lookahead scheduling
- 40–240 BPM with classical tempo markings
- Tap tempo pad (`TAP 4×`, or press `T`)
- Time signatures: 2/4, 3/4, 4/4, 6/8
- Volume slider, mute, and persistent favorite tempos
- Space starts and stops; arrows nudge BPM
- Control-free static export (`data-slop-export="hide"`)
- Dedicated 512×512 icon render target

```sh
bun slop dev examples/slops/metronome-tapper
bun slop build examples/slops/metronome-tapper
```
