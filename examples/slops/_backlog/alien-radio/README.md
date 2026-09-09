# Alien Radio

An original alien-console SomaFM receiver used to exercise hitSlop image-mask windows. The checked-in SVG is authoring artwork; `artwork/render.sh` generates the runtime chrome and binary-alpha mask under `assets/`.

```sh
./artwork/render.sh
bun slop dev examples/slops/alien-radio
bun slop build examples/slops/alien-radio
```

Playback starts only after the listener presses play. The app reads SomaFM's public channel metadata and playlists directly, does not proxy or record streams, and links back to SomaFM support.
