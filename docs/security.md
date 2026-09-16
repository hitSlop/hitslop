# Native runtime security

A `.slop` contains untrusted executable web content. Swift owns persistence,
room credentials, and native dialogs. This hardening applies to the macOS host;
iOS/iCloud and a full macOS App Sandbox are separate work.

## Browser and native access

Each runtime uses a non-persistent WebKit data store. Only the active session's
own WebView and main frame at `slop://app` can call the bridge. Only the entry
page and same-document fragments can navigate inside the WebView. HTTP(S) link
actions, including new-tab links, open in the system browser. Custom schemes,
additional WebViews, frames, forms, and automatic downloads are rejected.

The resource handler exposes app HTML, immutable assets, validated named media,
and validated theme CSS. It does not expose manifests, raw stores, or `state/`.
Resource reads open directory components without following symlinks, verify a
regular file and its size, and read through the same descriptor. FIFOs and other
special files are rejected. Immutable package limits are 256 entries, 25 MiB per
file, 50 MiB total, and 64 KiB for the manifest.
Sharing-time schema reads and cached bootstrap ZIP reads use the same bounded
reader; an unsafe cached file fails sharing without being replaced.

Direct HTTP(S)/WS(S) networking, WASM, and blob workers remain enabled. There is
no localhost/LAN isolation guarantee. A network-enabled slop can transmit its
own document data and media the user permits it to capture. CSP and navigation
restrictions do not change that product choice.

## Camera and microphone

Interactive macOS sessions use WebKit's normal permission prompt for camera,
microphone, or both. The host never returns an automatic grant. Background
preview/export sessions cannot prompt for capture or file selection. Closing or
reloading a runtime stops capture through WebKit's native capture-state APIs.
The macOS app has its own capture entitlements and usage descriptions; no
permission database, capture bridge, or launch-time access request is involved.

Release verification requires a signed app on a real Mac: camera-only,
microphone-only, combined, user denial, OS denial, close/reload, and background
rendering. Preview streams should use `video.srcObject`; discard streams after
checking them and never upload or retain test frames. Automated delegate tests
verify decisions without requesting physical device access. They cannot verify
TCC prompts or the camera indicator.

Run `bun scripts/native-runtime-check.ts` on macOS for the full native suite,
including freshly built Soma Amp and Quick Checklist packages. CI and the local
release check use this runner. A synthetic canvas-stream test verifies actual
`srcObject` video rendering under the existing CSP without accessing devices.
The navigation policy is tested without launching a browser; verify the Soma
Amp “GET SKINS” click opens the system browser during the signed-app manual pass.

## Admission and persistence

Bridge requests are limited to 64 KiB for control calls, 1 MiB for document edits,
and 36 MiB for media writes (including base64). JSON nesting is limited to 64
levels. There are at most eight outstanding asynchronous requests and one media
write per bridge. These checks precede schema validation and task creation;
WebKit itself necessarily deserializes the incoming script message first.

Document data is limited to 1 MiB of serialized JSON and 64 nesting levels.
Initial data, external edits, and candidate Loro projections are checked before
commit. External files that fail validation remain untouched. One native owner
tracks at most 16 edit sessions and 128 active drafts; records are released on
draft completion or page teardown. Limit rejection never silently drops an edit.
A rejected admission does not consume its sequence; the guest retains a failed
edit until explicit recovery.
Once admitted, a failed edit consumes its sequence and caches the failure for
identical retries; edit fingerprints use sorted JSON keys. Size/depth failures
at that stage retain a safe explanation under `validation_failed`; they must
not become `limit_exceeded`, which tells
the guest that admission did not consume its sequence.

Reload/close revoke queued guest requests. Normal close retains the existing
flush barrier. Full-state notifications retain only the newest pending frame;
operation history remains in the native journal and room protocol.

SQLite opens with `NOFOLLOW` and `trusted_schema=OFF`. The host checks its known
schema before initialization, rejects unexpected tables/views/triggers/indexes,
and checks column types before reading. SQL/column/result bounds also limit
malformed database loads. Invalid databases are reported, not reset or repaired
by deleting user data. Native diagnostics stay native; guest errors use stable
codes and safe messages.

## Cloud authentication

Production accepts Firebase authentication, with no `ALLOW_TEST_AUTH` switch.
Local integration tests use a separate Worker entry under `apps/cloudflare/tests`.
Room tokens require a key containing at least 32 bytes; generate it with a CSPRNG
(e.g. `openssl rand -hex 32`) and provision it as a Worker secret. Length checks
cannot establish the entropy of an operator-supplied secret.

Every signed claim is validated, including identity, profile strings, owner
boolean, and bounded expiry. Durable Objects continue checking membership on
every frame and closing connections on revocation. This change does not deploy
or rotate an existing production secret.
