# Decisions

Append-only. Add an entry whenever a Non-negotiable in `CLAUDE.md` (or a rule in `Rules.md`/`Architecture.md`) is deliberately overridden, or a real trade-off gets settled instead of relitigated every time it comes up. Newest first.

Entries below dated from git history are backfilled from existing code comments at doc-generation time (2026-09-01) — `date` is the file's last-touched date in git, not necessarily when the decision was first made, and `approved by` is unrecorded. Both are marked `TODO(owner): confirm` where the original author/date isn't recoverable from the repo.

---

## `uploadedImageCaching` now answers any cached width for a product image (reverses the per-width-entry decision below)

- **Date:** 2026-09-06 (`src/service-worker/sw.ts`).
- **Decision:** `uploadedImageCaching`'s `CacheFirst` strategy now sets `matchOptions: { ignoreSearch: true }`, so any previously-cached width/quality variant of a product's image answers a request for a different width of the same URL. This reverses the "Constraint this entry must keep: no `matchOptions`" line in the entry below.
- **Alternatives rejected:** Proactively warming every rendered width (grid card, cart-line thumbnail, product-options modal) for every product the moment `fetch_cate_products` is cached — would keep per-width precision but needs a new warm-up pass to maintain alongside `WARM_OFFLINE_ROUTES` for comparatively little benefit on a POS UI where product photos are identification aids, not pixel-critical. Forcing every `<Image>` call site to share one fixed `sizes` value — would also fix the collision but constrains layout decisions across every product-photo surface in the app for the same underlying goal.
- **Reason:** `next/image` requests a different `w=` for the same product depending on where it renders — a wide grid card (`order-customer-product-card.tsx`, `deviceSizes`-scale) vs. a ~40-44px cart-line thumbnail (`cart-items.tsx`, `imageSizes`-scale) are genuinely different cache keys under exact `ignoreSearch: false` matching. Opening a menu online only ever warms the grid's width for every product in view — it does not warm the cart-line width for a product that has never actually been added to an order online. Android offline order-taking (this session) makes that combination common: a cashier can now open a table and add any simple menu item offline even if it was never ordered before, and its cart line then requests a width that was never fetched, with no network to get it — a broken image where a same-size-answers-close-enough one is a clearly smaller UX cost.
- **Approved by:** repo owner (2026-09-06, in-conversation — asked for offline product images to keep working right after the offline order-taking fix landed).

## `navigator.onLine === false` may seed and shorten the OFFLINE verdict

- **Date:** 2026-09-03.
- **Decision:** Three narrow exceptions to `Architecture.md`'s "Browser/Electron network events trigger probes but never set state directly":
  1. `initialBackendNetworkSnapshot()` starts in `OFFLINE` (not `CHECKING`) when `navigator.onLine === false` at cold start, with `consecutiveFailures` seeded at `BACKEND_OFFLINE_FAILURE_THRESHOLD`.
  2. `offline-transport-monitor`'s `applyProbeResult` passes `failureThreshold: 1` when a `/sync/health` probe fails **and** `navigator.onLine === false`, so that combination declares `OFFLINE` on the first strike instead of three.
  3. `shouldPreferOnlineTransport` / `shouldRouteToLocal` (in `offline-sync.ts`) and `api.ts`'s catch-block fallback treat `navigator.onLine === false` the same as a latched `OFFLINE` verdict for **routing a supported read to the Local Agent** — so a screen's mount-time load reaches the Agent immediately instead of erroring against a dead backend while the first probe is still pending. Both predicates take the flag as a defaulted parameter (`navigatorReportsOffline()`) so unit tests stay deterministic.
- **Scope:** `navigator.onLine` is still never read alone as a verdict. Case 1 is only the pre-probe seed; case 2 always pairs it with a real confirmed probe failure; case 3 only ever routes an endpoint that already has an offline path and, in `api.ts`, only after a real transport failure of that request. Any HTTP response from the probe still flips straight back to `ONLINE`, so a wrong hint self-corrects within one poll (~2s). `navigator.onLine === true` (the normal path) is byte-for-byte unchanged, including the 3-strike requirement and "route to Backend unless OFFLINE".
- **Alternatives rejected:** Keeping `CHECKING` as the cold-start state — leaves the first login and every first read hitting a dead backend for 6–12s with no agent fallback (the catch-block fallback in `api.ts` requires state to already be `OFFLINE`), so a fully-offline device could not start up. Reproducing offline reads from a browser cache instead of the Agent — deliberately not done for live POS data (see `offline-db.ts` `SAFE_BROWSER_FALLBACK_PATHS`).
- **Reason:** On desktop browsers `navigator.onLine === false` is a reliable *negative* — it is never false while a working connection exists (only `true` is unreliable). Treating it as a hint that biases the *starting* state and collapses the debounce *when a probe agrees* keeps the "no false OFFLINE on a healthy network" guarantee while letting a genuinely offline device enter full offline mode immediately. Also lowered `applyBackendTransportFailure`'s internal floor from `Math.max(2, …)` to `Math.max(1, …)`; the default threshold is `3`, so every existing caller is unaffected.
- **Approved by:** repo owner (2026-09-03, in-conversation), for the Chrome + separately-installed Printer Agent deployment.

## `next build` must keep `--webpack`

- **Date:** last touched 2026-08-31 (`next.config.ts`) — `TODO(owner): confirm` original decision date.
- **Decision:** `package.json`'s `build` script is `next build --webpack`, never bare `next build`.
- **Alternatives rejected:** Letting Next.js 16 default `next build` to Turbopack.
- **Reason:** `@serwist/next`'s classic InjectManifest mode (compiles `src/service-worker/sw.ts` → `public/offline-sw.js`) only supports webpack. Turbopack doesn't error when it hits an unsupported plugin — it silently skips it, so the build "passes" with no offline service worker shipped. This is now `CLAUDE.md` Non-negotiable #5.
- **Approved by:** `TODO(owner): confirm`.

## Manual (non-glob) service-worker precache walk on Windows

- **Date:** last touched 2026-08-31 (`next.config.ts`).
- **Decision:** `collectPublicPrecacheEntries()` walks `public/` by hand and joins paths with `/` explicitly, instead of using `@serwist/next`'s built-in `globPublicPatterns`.
- **Alternatives rejected:** `globPublicPatterns` (the documented Serwist option).
- **Reason:** The underlying `glob` package returns backslash-separated paths on Windows even when the pattern uses `/`, producing broken manifest URLs (e.g. `/auth\login-hero.png`) and 404s on SW install for anything built on Windows — including `electron:pack`, which builds the Windows installer directly on a Windows machine. The hand-rolled walk sidesteps this regardless of build platform.
- **Approved by:** `TODO(owner): confirm`.

## Precache list is an explicit allowlist, not "all of `public/`"

- **Date:** last touched 2026-08-31 (`next.config.ts`).
- **Decision:** `PRECACHE_PUBLIC_INCLUDES` in `next.config.ts` lists specific subpaths (`auth`, `brand`, specific font files, `landing`, `locales`, `manifest.webmanifest`, `pos`, `sounds`) instead of precaching everything under `public/`.
- **Alternatives rejected:** Serwist's default (`globPublicPatterns: ["**/*"]`, precaches all of `public/`).
- **Reason:** The default swept in unused printer drivers, installers, 3D models, and fonts (~64MB), which blocks SW install until fully cached and slows activation of a new SW version after every deploy. A normal refresh (which goes through the SW) then still serves the stale version until the bloated new one finishes installing — indistinguishable from "the deploy didn't work" to whoever's debugging it. `app-version.json` is deliberately excluded from precache for the same class of reason: it must stay `NetworkOnly` so version checks aren't frozen at install time.
- **Approved by:** `TODO(owner): confirm`.

## LAN IP hardcoded in `allowedDevOrigins`

- **Date:** last touched 2026-08-31 (`next.config.ts`).
- **Decision:** `next.config.ts` hardcodes `192.168.100.247` (documented inline as "current dev machine's LAN IP") in `allowedDevOrigins`, with `CAPACITOR_DEV_ORIGIN` as an env override.
- **Alternatives rejected:** None recorded — this looks like a working default that needs manual updating, not a deliberated choice between options.
- **Reason:** Without an allowed origin, the Next dev server 403s `/_next/static/chunks/*.js` for any request whose origin isn't allowlisted — so Capacitor Android testing over Wi-Fi against the dev server needs this. Whoever's LAN IP changes (new network) must update this value or set `CAPACITOR_DEV_ORIGIN`.
- **Approved by:** `TODO(owner): confirm`. **Flag:** this is dev-machine-specific state committed to source; worth revisiting if it causes friction across contributors' machines — not changed here since no alternative was requested.

## `src/lib/offline-routes.ts` and `offline-sync.ts`'s route lists are two hand-synced allowlists

- **Date:** last touched 2026-08-31 (`src/lib/offline-routes.ts`).
- **Decision:** Offline-eligible pages (`offline-routes.ts`) and offline-eligible API endpoints (`OFFLINE_ROUTES`/`OFFLINE_GET_ROUTES` in `offline-sync.ts`) are maintained as two separate lists rather than one derived from the other.
- **Alternatives rejected:** `TODO(owner): confirm` — no note in the repo on why these weren't unified into one source of truth (e.g. a page manifest that declares its own required endpoints).
- **Reason (as documented in-repo):** They describe the same feature from two different layers (route allowlist vs. endpoint allowlist) and must be updated together — this is now `CLAUDE.md` Non-negotiable #7.
- **Approved by:** `TODO(owner): confirm`.

## `sw.ts` owns a `/_next/image` runtime-caching entry for product images

- **Date:** 2026-09-03 (`src/service-worker/sw.ts`).
- **Decision:** `uploadedImageCaching` matches `/_next/image?url=…` when the decoded `url` parameter points at `/uploaded/`, `/uploads/` or `/products/`, and caches it `CacheFirst` (300 entries, 30 days). Every other Next Image request still falls through to `@serwist/next`'s `defaultCache`.
- **Alternatives rejected:** Leaving all Next Image caching to `defaultCache` (the previous rule, guarded by a test asserting `sw.ts` contained no `_next/image`); marking the product `<Image>` components `unoptimized` so the browser requests the backend URL directly.
- **Reason:** The old matcher tested `url.pathname.includes("/uploaded/")`, but `next/image` never requests the product URL — it requests `/_next/image?url=<encoded>&w=…&q=…` on the app's own origin, so the pathname is always `/_next/image` and **no product image was ever cached**. Offline POS menus and carts rendered placeholders. `defaultCache` does cover `/_next/image`, but at 64 entries / 24h `StaleWhileRevalidate` — too small to hold a menu and expiring overnight, so it cannot carry a shift offline. `unoptimized` would fix caching too, but gives up AVIF/WebP and resizing on the most image-heavy screen in the app.
- **Constraint this entry must keep:** no `matchOptions` on the strategy. `caches.match()` defaults to `ignoreSearch: false`, so `?url=…&w=…` stays part of the key and each rendered width is its own entry; setting `matchOptions` would let one width answer for every size. `offline-service-worker.test.ts` guards this.
- **Approved by:** `TODO(owner): confirm`.

## Product image URLs are resolved in the sync payload, not on the Agent

- **Date:** 2026-09-03 (`back-end/api/v1/sync/registry.js`).
- **Decision:** `enrichSyncPayload` resolves `products.prod_image` to a full URL with the same `buildImageUrl` helper the REST readers use, and keeps the stored object key in `prod_image_raw`. The Printer Agent passes both through unchanged.
- **Alternatives rejected:** Teaching the Agent the object-storage host and prefix so it could build the URL itself; loosening the POS to accept scheme-less object keys.
- **Reason:** `tb_product_list.prod_image` holds an object key, not a URL. Every REST reader resolved it before answering, so the Agent was the one consumer receiving the raw key — and `publicProductImageUrl` / `cartItemMedia` drop any value that does not start with `http`, so offline menus and carts showed placeholders while online showed images. Resolving at the sync boundary keeps online and offline byte-identical and leaves the Agent with no knowledge of object storage. `prod_image_raw` follows the split the product REST API already uses for edit forms.
- **Migration note:** Agents keep pulled rows until the next delta, so existing installs serve the old raw key until products are re-pulled. `cartItemMedia` treats a non-`http` value as "no image" so those rows render a placeholder rather than crashing `next/image`.
- **Approved by:** `TODO(owner): confirm`.
