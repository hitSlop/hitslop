# Native v1 security

Only `hitslop-v1` packages are accepted. There is no pre-v1 compatibility or migration.

The document engine is pinned Loro JS/WASM inside a nonpersistent WKWebView. Swift owns package validation, resource delivery, the bridge, SQLite, and the OS writer lock. Swift does not interpret application fields. Authored code can change or damage its own document; it never receives Firebase or future room credentials.

`slop://app` exposes only app.html, state.schema.json, initial.json, assets, and host runtime resources. State databases and discovery files are not served. Resource reads use descriptor-relative no-follow opens, reject nonregular files, and enforce a 25 MiB file limit. Package validation also limits immutable contents to 256 entries and 50 MiB. Symlinked package entries are rejected at open and resource access.

CSP permits local scripts and WASM, local connections, inline styles, and local/data images and fonts. It does not enable arbitrary remote fetches. The native navigation policy cancels external navigation; an explicit HTTP(S) link opens in the system browser. This policy is not a claim that arbitrary authored code is a safe place for secrets. Camera and microphone host grants are not part of v1.

Bridge calls must originate in the main frame at slop://app and match generated TypeBox envelopes. Requests are limited to 48 MiB serialized; storage accepts at most 32 MiB of aggregate checkpoint/update bytes and 4096 log rows. Checks precede blob materialization. SQLite uses NOFOLLOW, trusted_schema=OFF, DELETE journaling, and synchronous=FULL. Swift stores opaque bytes and checks generations.

One permanent state/writer.lock inode owns each local package. Never unlink it or bypass a busy lock. state/host.lock is discovery JSON, not ownership. A busy writer without a reachable socket is an error. Socket requests/replies are bounded to 1 MiB/16 MiB, use one request per connection, and have bounded concurrency and timeouts. Transport failure does not prove a mutation failed: run slop get before another edit.

Close and quit prepare every document before releasing ownership. Failed saves retain pending edits and the writer lease. Renderer recovery replaces the WebView under the same lease and restores saved state; unsaved renderer memory cannot be recovered. Export stages output outside the package and publishes by atomic rename before its deadline.

Firebase startup, Analytics, Crashlytics, and App Check remain enabled in Release. Document data stays local; account UI, hosted loading, public publishing, rooms, media import, iCloud, and synced folders are deferred. See sharing-later.md for the future boundary.

Theme commands share the document writer lease. `state/theme.json` is a bounded (64 KiB) map of token values, read through the bridge rather than the resource scheme. JavaScript validates declared token names and CSS values; native code validates envelopes, isolation, and size. Arbitrary override stylesheets are unsupported.
