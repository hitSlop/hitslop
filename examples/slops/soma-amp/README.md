# SomaAmp

A fixed-size, classic-skin-compatible SomaFM receiver built with Webamp. Drop a classic `.wsz` to reskin; the selected skin is stored as named document media.

```sh
bun slop dev examples/slops/soma-amp
bun slop build examples/slops/soma-amp
bun slop validate examples/slops/soma-amp/dist/soma-amp.slop
```

SomaAmp does not proxy or record streams. Webamp is Copyright (c) 2015 Jordan Eldredge (MIT).
