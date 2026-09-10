# Alien Radio

A PNG-skinned SomaFM receiver. The checked-in SVG is authoring artwork; `artwork/render.sh` generates the chrome and binary-alpha mask under `assets/`.

```sh
./artwork/render.sh
bun slop dev examples/slops/alien-radio
bun slop build examples/slops/alien-radio
bun slop validate examples/slops/alien-radio/dist/alien-radio.slop
```

Playback starts only after play. Streams come from SomaFM; the receiver does not proxy or record them.
