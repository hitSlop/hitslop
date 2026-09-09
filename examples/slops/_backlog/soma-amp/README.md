# SomaAmp

A fixed-size, classic-skin-compatible SomaFM receiver built with Webamp. It ships a curated list of eight stations because SomaFM's catalog API is no longer available to third parties. Playback resolves SomaFM's permanent PLS links at launch and starts only after a listener presses play.

Drop a classic `.wsz` file on the player, choose **Load .wsz**, or use Webamp's **Options → Skins → Load Skin…**. The selected skin is validated and stored as named document media, so it returns when the document reopens. Modern `.wal` skins are not supported.

```sh
bun slop dev examples/slops/soma-amp
bun slop dev examples/slops/soma-amp --native
bun slop build examples/slops/soma-amp
```

After `bun slop register examples/slops/soma-amp`, create a writable SomaAmp
from **My Templates**. The installed catalog master intentionally has no
stores; each created document owns its selected station and uploaded skin.

SomaAmp does not proxy or record streams. SomaFM is listener-supported; the receiver keeps a direct support link visible. Webamp is Copyright (c) 2015 Jordan Eldredge and distributed under the MIT License.
