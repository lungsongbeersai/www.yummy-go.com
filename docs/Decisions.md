# Decisions

Append-only. Add an entry whenever a Non-negotiable in `CLAUDE.md` (or a rule in `Rules.md`/`Architecture.md`) is deliberately overridden, or a real trade-off gets settled instead of relitigated every time it comes up. Newest first.

Entries below dated from git history are backfilled from existing code comments at doc-generation time (2026-09-01) — `date` is the file's last-touched date in git, not necessarily when the decision was first made, and `approved by` is unrecorded. Both are marked `TODO(owner): confirm` where the original author/date isn't recoverable from the repo.

---

## New-order rows restore hard delete

- **Date:** 2026-09-08.
- **Context:** The owner requested the previous Delete Item action back after adding an item. The prior same-day decision hid every destructive action in the table's New tab, even though the Backend delete contract and Mobile Offline payload already support status 0/1 rows.
- **Decision:** The table New tab exposes Delete Item for status 0/1 again, using the existing confirmation dialog and `delete_order_item` flow. It does not expose Cancel Item there. History keeps audited cancellation for status 2/3, while served, cancelled, and unknown statuses remain protected.
- **Reason:** This restores the cashier's requested pre-confirmation correction flow without replacing the inventory/audit-safe cancellation path required after an item reaches the kitchen.

## New-order rows do not expose destructive actions

- **Date:** 2026-09-08.
- **Context:** The table cart's New tab showed both hard delete and audited cancel for status 0/1. On Mobile Offline, hard delete also failed because its item UUID existed only in the query while the durable reducer reads mutation bodies.
- **Decision:** The table New tab exposes neither Delete Item nor Cancel Item. Confirmed active items in History use the audited cancel flow only at status 2/3. Status 4 is already served and remains protected; status 9 is already cancelled. No-table status 0/1 rows retain hard delete because they do not have a separate New tab. The delete request mirrors its UUID into the body while retaining the online query parameter, allowing Dexie to decode and stage legitimate hard deletes.
- **Reason:** Backend hard delete is intentionally limited to status 0/1. Status 2/3 must become status 9 through `cancel_order_item` so stock restoration, cancellation printing and audit history remain correct. Backend explicitly rejects cancellation after status 4; changing that inventory/accounting rule is outside a menu-visibility fix.

## Public landing pages are installed offline on one canonical origin

- **Date:** 2026-09-08.
- **Context:** Opening `yummy-go.com` without Internet fell through to Chrome's `ERR_INTERNET_DISCONNECTED` page even though the authenticated POS shells had an offline path. The public landing redirects through `/home`, and both `www.yummy-go.com` and `yummy-go.com` were serving independent successful responses even though service-worker state is origin-scoped.
- **Decision:** `/`, `/home`, `/policy`, and `/login` are offline infrastructure routes and are warmed during service-worker installation, before authentication. `www.yummy-go.com` permanently redirects to the canonical `https://yummy-go.com` origin while online so both entry hostnames establish the same future offline installation. Public fallback never redirects `/policy` into protected POS.
- **Boundary:** A browser must complete one online visit and service-worker installation on the canonical origin before any website can open without a network. Clearing site data, using a new browser/device, private browsing, or attempting the first visit offline still cannot load the remote site. This document-shell work does not make public QR API calls or Socket.IO operate without Backend connectivity.

## Every established menu destination is viewable offline on desktop and Capacitor

- **Date:** 2026-09-08.
- **Context:** The owner explicitly requested that destinations showing the temporary offline lock open on web/desktop and mobile, including package, cancellation and settings screens.
- **Decision:** Desktop and Capacitor now share one protected-page allowlist. The service worker warms every corresponding HTML shell after registration/login. Each GET used by the newly opened read-only screens is admitted by both the Agent/Dexie cache-write policy and the scoped browser fallback policy, with tests requiring page, API and fallback lists to remain aligned.
- **Safety boundary:** This is offline *view* access, not blanket offline mutation support. Existing reviewed POS mutations keep their durable outbox behavior; package, cancellation, master-data and permission writes remain online-only until each domain has an idempotency, dependency and conflict policy. Mobile-only Agent screens may open but still report unavailable operations when no native implementation exists.
- **Trade-off:** Generic responses use the existing exact-request, store/branch-scoped cache with its 48-hour browser age limit. A filter/page request that has never succeeded online can still report a cache miss; serving a different branch, filter or page as if it matched was rejected. No database schema change, cache wipe, deployment or claim of physical-device acceptance is included.

## Prepare mobile menu options and share direct product-image caches

- **Date:** 2026-09-08.
- **Evidence:** Category responses contain product rows only for the selected category/sort, and option products omit the default detail id/price. Native sync previously pushed bills but never prepared the full menu. The menu renders remote images unoptimized, while cart thumbnails used Next's optimizer; additionally Serwist CacheFirst drops opaque CDN responses unless `cacheWillUpdate` accepts them.
- **Decision:** While Backend is confirmed online, the native monitor starts a separate, single-flight, branch/cashier/language-scoped menu preparer. It reads the initial catalog, every category in all three sorts, then each product's real option/topping response through `apiRequest` (two concurrent requests). It validates persisted Dexie responses before reporting internal preparation completion, pauses new work on disconnect/session change, reuses fresh results for five minutes, and retries partial preparation after 30 seconds. It does not wait for device registration or drain/alter the bill queue. No new offline notices or UI layout changes.
- **Retention and sale snapshots:** Fresh native menu entries are retained separately from the general 300-response cap, with the existing 48-hour age policy and device quota still in force. New local creates persist item display/base/topping prices as metadata outside the frozen Backend payload. Existing resolvable legacy drafts receive the same metadata before background refresh, without changing event ids, requests, statuses or timestamps. Unknown historical prices remain unknown rather than being guessed. Normal option size/topping labels survive cart reconstruction; an option product never falls back to one fabricated default size.
- **Images:** Cart remote images now use the same direct URL as menu cards. A shared cache helper accepts actual image responses and opaque no-cors CDN images, retaining signed source parameters. Background preparation fetches product images without credentials and awaits cache writes. Image-cache matches ignore `Vary`, not the source query; Next optimized variants for other surfaces still retain their source identity. Runtime image expiration/quota policy remains in place. Opaque responses cannot prove HTTP success or image decoding, so physical-device image acceptance remains required.
- **Boundary:** Menu preparation is not a complete offline-checkout readiness signal. Full native app cold start, stock/promotion/set and tax/service parity, durable kitchen/receipt printing, payment proofs and physical Android/iOS acceptance remain open. No SQL/Dexie schema bump, database wipe, dependency installation, commit, push or deployment is included.

## Mobile menu reads recover online independently of pending bills

- **Date:** 2026-09-08.
- **Evidence:** After reconnect, a pending or blocked Dexie event routed category and product-detail requests into the exact offline cache even with a reachable Backend. A category/product not previously cached then raised `mobileCacheUnavailable`; native cache protection also rejected fresh master data while any bill was pending.
- **Decision:** Exempt only `GET fetch_cate_products`, `POST get_prod_item` and `POST status/fetch_size` from native pending-order ownership and the late-order-version guard. Confirmed `OFFLINE` still reads Dexie; `CHECKING`/`ONLINE` may load those reads from Backend. Keep cart/table snapshots, bill initialization, edits, kitchen/payment and unsupported mutations on their existing ownership/safety rules. Desktop Agent routing and UI are unchanged.
- **Persistence:** Native menu responses await their scoped cache write before immediate add-to-cart can use them. A local storage failure does not turn a successful Backend read into an offline verdict; local writes retain their validation. Menu cache refresh is allowed while cart replacement remains guarded. Native pruning pauses while this branch has pending/blocked work, within the same cache transaction, so browsing new categories cannot evict its recovery base; the normal cap resumes on a cache write after acknowledgement.
- **Trade-off:** Pending/blocked bills and event payloads are neither cleared nor marked synced to unlock the menu. Temporarily retaining more than 300 cached responses protects recovery data, but does not remove the device storage quota or provide complete mobile pricing/bootstrap/printing parity. Tests use mocked transports/in-memory storage, not physical Android/iOS acceptance. No push, deployment or installer is included.

## Mobile offline cart reads the real Backend line contract; warm actual HTML shells

- **Date:** 2026-09-08.
- **Evidence:** Owner reproduced a green fallback page and unnamed zero-valued cart rows with Internet disabled on Android. `fetchCartShared` sends `title` and `detail.unit_price` without a product-detail id. Previous offline tests invented `prod_name`/`pro_detail_uuid`, so the reducer's master-index lookup lost real cached lines.
- **Decision:** Retain each original order/item snapshot in reconstructed local state, preferring that line's display/price over the menu or another bill. Read actual service/VAT aliases and numeric discounts, preserve receipt metadata, and normalize topping quantities per unit. Keep base and topping prices separate as Backend does. Missing product/price data raises an explicit error instead of a successful blank/zero cart; validate before staging new work. Original Dexie cache/outbox records are not rewritten or deleted.
- **HTML recovery:** Install warms login, tables and order HTML, not just login. Warm requests accept only real successful HTML and acknowledge after cache writes; foreground/reconnect retries warming. Error fallback can read the HTML-only cache despite Next RSC Vary headers, or redirect a missing staff route to cached tables. It does not substitute staff pages for QR tokens or loop a missing login back to protected pages. AuthGuard is unchanged.
- **Boundary:** This repairs cached mobile carts and shell recovery, not a bundled native app. First launch without a prepared shell, cache eviction/version coherence, iOS WebView support and real-device force-close acceptance remain unverified. Native offline print/payment guards remain in place; no claim of complete offline checkout, database migration, push or deployment.

## Offline notices require confirmed Backend failures, never browser hints

- **Date:** 2026-09-08.
- **Context:** Owner explicitly requested no offline notification unless connectivity is actually lost, on desktop and Capacitor Android/iOS.
- **Decision:** Supersedes cases 1 and 2 of the 2026-09-03 navigator exception below. Startup is always `CHECKING` with zero failures. Only three consecutive response-less health-probe failures declare `OFFLINE`; browser events and login/API failures do not count as confirmation. Existing local routing hints, Agent/Dexie ownership and print safeguards remain unchanged.
- **Ordering:** A probe failure is ignored when an HTTP response or monitor reset occurred after that probe started. Health success wakes only the sync worker, not another health probe; external resume/retry events may wake both.
- **Notification:** One warning per confirmed outage. `CHECKING` never produces an offline or back-online notice, and recovery requires an actual HTTP response. Printer/Agent availability, queued work and local authentication are not connectivity evidence.
- **Trade-off:** The warning waits for confirmation even if the browser immediately reports offline. Backend unreachability is not a claim that every Internet service is down; the existing notice identifies the Yummy Go connection. No installer, deployment or mobile offline-checkout readiness is implied.

## Capacitor mobile uses Dexie, never the desktop Agent

- **Date:** 2026-09-08.
- **Context:** Owner explicitly confirmed that both Android and iOS use Dexie + Capacitor and do not use a Printer Agent. This corrects the Android-only platform assumptions in `Architecture.md`; desktop transport is retained.
- **Implementation:** Native platform detection also recognizes the configured app user-agent markers. Both platforms start the direct sync worker, register with their own platform name, and wake on native foreground events. POS reads stay local while the branch has pending or blocked events. A confirmed offline verdict goes straight to Dexie. Native login preparation never sends credentials to localhost.
- **Durability:** Event staging, acknowledgement, and native cache guards use Dexie transactions. The worker sends one acknowledged event at a time because Backend prioritizes payments ahead of creates within a batch. Wire data is frozen before sending, retained across response loss, and never silently retargeted on retry. Store/branch/actor checks and single-flight workers prevent cross-session replay. Cache watermarks prevent an acknowledged quantity change being applied twice after a server refresh. Synced parents are retained while recovery work remains.
- **Safety boundary / not feature-complete:** Existing mobile reducers can synthesize kitchen/payment success but have no native durable print jobs, routing proof, or offline receipt renderer. New offline kitchen confirmations and payments are therefore rejected before staging. Historical records of these operations are preserved as `BLOCKED` with `MOBILE_OFFLINE_PRINT_REVIEW_REQUIRED`; they must not be deleted or replaced with a new event id. This is intentionally a transport/durability hardening checkpoint, **not approval to deploy mobile offline checkout**.
- **Trade-off:** Branch-wide sequential recovery is conservative: an unresolved earlier event or another cashier's queue holds later work. Independent-order batching can be added only after durable dependency extraction and native printer evidence are implemented. The current remote-URL Capacitor shell, sale-time VAT/service/pricing snapshots, native print planning/renderer/outbox, and offline cold-start acceptance remain open. See `Mobile-Offline-Acceptance.md`.

## Retain local order ownership while reconnect is draining durable work

- **Date:** 2026-09-07.
- **Context:** Owner requested usable Windows/Mac + Printer Agent offline-to-online POS parity. Reachable Backend does not imply that an offline order exists there yet.
- **Implementation:** `apiRequest` checks branch/store-scoped Agent and browser outboxes for routes already in the offline allowlist. Pending/processing/failed work and Agent-blocked conflicts keep these routes on the Agent. An in-flight local write and a small persistent recovery marker protect the handoff across reload and ambiguous local responses. An unavailable Agent without local work does not select SQLite; unsupported routes keep their online behavior. No page/API allowlists or UI layouts change.
- **Network boundary:** Backend NetworkManager remains the sole reachability authority. Retaining business ownership never sets `OFFLINE`, logs out the cashier, or treats an HTTP business rejection as a network failure.
- **Trade-off:** Recovery is scoped to the whole local branch rather than individual orders: table joins/splits, queues, stock and receipts share state. While unresolved work remains, the till uses cached master data; blocked conflicts require review. Switching each call back online immediately would permit payment before order replay, whereas forcing all online sales through the Agent would unnecessarily make healthy online operation depend on it.
- **Rollout:** Backend and Agent also change. Update both plus the frontend, retain SQLite/device identity, and complete online bootstrap (`order_snapshot_version: 1`) before testing offline. Physical printer acceptance is required separately; automated checks are not a Windows/USB/Wi-Fi device certification.

## `uploadedImageCaching` keys on the decoded source image, not `matchOptions: { ignoreSearch: true }` (corrects the entry below)

- **Date:** 2026-09-06 (`src/service-worker/sw.ts`), same day as the entry below.
- **Decision:** Replace `matchOptions: { ignoreSearch: true }` with a `cacheKeyWillBeUsed` plugin (`imageCacheKeyPlugin`) that rewrites a `/_next/image?url=<source>&w=..&q=..` request's cache key to `/_next/image?url=<source>` — dropping only `w=`/`q=`, keeping `url=`.
- **Alternatives rejected:** Keeping `matchOptions: { ignoreSearch: true }` (the entry below, shipped and reverted the same day) — Cache API's `ignoreSearch` drops the *entire* query string during `cache.match()`, not just the part that varies per render. Since `url=` (which image) and `w=`/`q=` (which size) are both query parameters on the same `/_next/image` path, ignoring "the query string" ignored `url=` too: every product's `/_next/image` request collapsed onto whichever entry the cache happened to return first, so products showed no photo, or another product's photo, at random. This was caught from real-device testing ("some photos show, some don't") within hours of the previous entry shipping.
- **Reason:** The actual need was narrower than `ignoreSearch` can express: ignore `w=`/`q=`, keep `url=`. Only a custom cache key (via `cacheKeyWillBeUsed`, applied on both the read and write side of `CacheFirst`) can express "ignore some query parameters but not others" — there is no built-in `matchOptions` for it.
- **Approved by:** repo owner (2026-09-06, in-conversation — reported the wrong-photo/missing-photo symptom from real-device testing right after the previous entry deployed).

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
