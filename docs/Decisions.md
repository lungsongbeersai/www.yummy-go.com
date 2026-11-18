# Decisions

## Legacy native product cards receive clicks across their full surface

- **Date:** 2026-11-18.
- **Evidence:** The owner reported that the SUNMI sales page loaded slowly and product clicks through AnyDesk did nothing. Genuine Chromium 83 reproduced a 162.656px-wide card whose absolute action button was only 44px wide despite all four resolved insets being zero. A mouse click at the card center reached its decorative fallback instead of the button, producing no detail request or modal. Earlier button-centered checks missed this difference between the button and the visible card.
- **Hit target:** Explicit 100% button dimensions and physical insets apply only to direct product-card action buttons under `html.capacitor-android.android-webview-83`. Existing enabled/disabled states, handlers and card contents remain authoritative; web, Electron and capable Android selectors are unchanged.
- **Rendering:** The native legacy layout helper compares the body's inline declarations and skips a refresh when only Radix's pointer-events lock changes. Declaration order, values, priorities, removals, padding, dimensions, fonts and unknown/custom properties remain significant. Opening a real Radix modal no longer scans the unchanged catalog. The visible catalog memo depends on its active group, avoiding card recreation when another menu group finishes loading without changing displayed data or ordering behavior.
- **Returning to sales:** Closed dialog/sheet overlays and content end their animation immediately on native WebView 83. Actual wheel events exposed a closed, pointer-transparent overlay still owning RemoveScroll and swallowing a cashier's next scroll. Removing only the old native exit animation releases the existing Radix lock without a delay or a second gesture system; four repeated immediate-scroll checks passed.
- **Performance evidence:** Paired development-fixture checks used the actual POS shell/workflow on Chromium 83. With 300 cards, tap-to-request style reads fell from 4,491 to 182 and click-to-loading paint from 1,671ms to 1,344ms. With 16 cards under a simulated sixfold CPU slowdown, paint fell from 7,714ms to 2,936ms. Normal-speed 16-card paint was effectively unchanged (268ms versus 283ms). These are local development-fixture timings, not production or physical SUNMI latency measurements; first-load timing did not materially improve in that fixture. Idle style reads settled to zero in all measured profiles.
- **Validation:** All 3,795 tests in 299 files, typecheck, lint, twelve deployment fixtures and the webpack production build passed; lint retains five existing warnings. Local build ID: `kZS7L-yZPMOs9wtefZcUq`. Actual Chromium 83 checks covered five mouse and five touch locations across cards and 80 geometric hit targets. Six modern web/capable Android before/after cases retained identical card/button geometry and working center clicks.
- **Boundary:** No financial mutation, pricing, printing protocol or offline behavior changes. Browser checks use synthetic data and do not connect to the shop's AnyDesk session or physical terminal.
- **Authorization:** The owner's explicit request to restore usable product clicks and improve SUNMI speed while preserving other devices' working behavior.

## Shared overlays remain scrollable and checkout continues after an authoritative commit

- **Date:** 2026-11-18.
- **Evidence:** The owner requested correct modal placement, scrolling, payment totals and faster sales/kitchen/receipt operation on SUNMI WebView 83. A source inventory found 96 dialog/alert/sheet/drawer content uses. Actual Chromium 83 reproduced oversized top/bottom sheets and popovers, unscrollable side sheets/drawers, an off-screen command dialog and nested popover scroll gestures blocked by the parent modal's scroll lock.
- **Overlay layout:** Shared primitives constrain their height to the viewport and safe areas and provide native scroll containment; feature-owned inner scrollers keep their existing overrides. Command dialogs use the shared centered frame. Drawer surfaces paint the scroll viewport as well as their decorative frame, suppress Vaul's trailing pseudo-element that otherwise scrolls over their contents, allow native vertical panning and retain exclusive drag gestures on both handle variants. Standard dialog/sheet close buttons compensate only for their own root scroll offset, keeping the target reachable without page measurements or an idle loop. A React-only modal context gives nested popovers their own topmost Radix scroll lock while standalone popovers retain their existing behavior. Positioned popover, dropdown and tooltip content exposes its intended z-index to Radix's portal wrapper on Chromium 83.
- **Short payment viewports:** The payment window uses the measured visible height without a 320px minimum. A short narrow viewport scrolls the whole workspace under its sticky header so methods, amount inputs and action controls remain reachable even when the keyboard leaves little space.
- **Fast successive taps:** Closed modal surfaces explicitly override Radix's inline `pointer-events: auto` while fading out. Actual Chromium 83 captured a closed alert overlay receiving the next tap after its content detached; an important closed-state rule returns that tap to the visible parent control without adding a delay.
- **Money:** Foreign-tender ceilings use integer decimal arithmetic matching the backend's six-decimal exchange-rate contract. Exact mixed tenders use the server's allocation rule: cash is capped at the amount due, transfer fills the remainder and change is zero. This avoids binary floating-point over-ceilings and fictitious rounding change; genuinely overpaid, non-exact tenders retain their change calculation.
- **Commit and printing:** Start the existing owned print job before dismissing a committed payment, then refresh and print independently. Printer service execution maps, delivery ledgers, ACKs and immutable retry context retain ownership after the dialog closes. A failed receipt never becomes a failed payment or resubmits it. Mutation/payment/split-order IDs are captured before awaiting the server so a late receipt cannot refer to a newly selected bill. Manual invoice printing uses its inline indicator and persistent status toast instead of blocking the cashier behind another modal.
- **Kitchen:** Prepared cancellation receipt printing begins alongside the post-commit cart refresh. Kitchen reprints use synchronous and cross-remount action guards, and asynchronous completion cannot update another table/session. Existing queue delivery boundaries and draft-cleanup locks remain authoritative.
- **Validation:** All 3,791 unit tests in 299 files, typecheck, lint and the webpack production build passed; lint retains five existing warnings. All twelve deployment fixtures passed. Local build ID: `7IAU-XaYkRkSUgQVyxh2b`.
- **Browser verification:** Genuine Chromium 83 passed 27 shared-overlay scenarios across phone, POS landscape and short enlarged-font profiles, plus four drawer scenarios covering both handle variants. Raw production CSS checks covered native touch in both directions, viewport bounds, bottom actions and reachable close targets after scrolling. Long product options, short payment workspaces, nested menus, foreign/mixed tender and deferred/failed/stale receipt workflows were checked with synthetic stores and printer responses. The final build also passed rapid successive taps without extra delay and four deferred/failed print scenarios, with both payment and confirmation content detached before the printer replied.
- **Boundary:** Browser checks and fake printer responses verify layout, arithmetic, payload identity and workflow timing without production sales or physical printing. Physical SUNMI latency, network throughput and paper delivery still require device acceptance.
- **Authorization:** The owner's explicit request in this conversation to improve every modal and the speed/correctness of sales, kitchen dispatch, checkout and billing; the existing commit-and-push instruction remains part of this work.

## Product selection opens before its detail request completes

- **Date:** 2026-11-18.
- **Evidence:** The owner identified the missing modal as tapping a product to choose quantity/options. The launcher awaited server detail data before opening the overlay; touch does not benefit from the mouse-hover prefetch, so a slow or failed request left the user on the product grid.
- **Decision:** Open the existing product overlay immediately with a loading skeleton. Show server details and the editable order form only after a successful response. A failed request stays in that overlay with a visible error and retry button; no local product-option or financial success fallback is introduced.
- **Ownership:** Product reads have replaceable, cancellable leases. Closing the overlay or changing product/route/account/table/language/sort invalidates the old read. A scope instance and activation generation prevent late responses from reviving after leaving and returning to the same screen. Each finalizer may release only its own lease. Direct order sends use a separate non-cancellable lease kind until completion; reads that require details always open the form and cannot fall through into a financial send.
- **Completion:** Both form and direct sends retain their order lease until settlement. After the authoritative send, counter/cart/focus/toast updates also require the initiating activation and authentication session. Background cart callbacks retain that check after the send releases its lock; an old response cannot populate a new bill or login.
- **Validation:** All 3,758 unit tests in 297 files, typecheck, lint and production build passed; lint retains five existing warnings. All twelve deployment fixtures passed. Local build ID: `nbZANU8gvXPlhVbyIikCf`.
- **Browser verification:** Genuine Chromium 83 passed twelve actual product-launcher cases at desktop/mobile widths, including loading, retry, close/late responses, product replacement, scope changes, quantity and size selection. Six native shell profiles plus a modern Chrome web profile verified the shared header, anchored appearance menu, selected/focused labels, sidebar/account/submenus and Android Back behavior. These checks used the final raw production CSS and all five Next font variables, with no page/console errors, external requests or financial writes. Seven layout regression checks covered wrap resize, motion/idle stability, original inline priorities, RTL/auto margins, aspect sizing and moving a child after removing its old owner.
- **Authorization:** The owner explicitly requested fixing the missing product modal and slow SUNMI interaction.

## Legacy native layout reconciles changed owners instead of resetting the screen

- **Date:** 2026-11-18.
- **Evidence:** A genuine Chromium 83 benchmark with 300 synthetic product cards and 3,308 DOM nodes reproduced repeated full-screen style work without any network requests. The previous helper performed 57,099 computed-style reads and 16,200 inline style mutations, including main-thread tasks lasting over one second.
- **Decision:** Track flex-gap/aspect owners separately, discover only newly added subtrees, cache per-pass style/metadata reads, batch reads before writes and retain unchanged owned declarations. A new modal portal must not restore and rewrite every product behind it. CSSOM-normalized values are remembered to avoid repeated writes of equivalent expressions. Disconnected owners release their styles, original inline values/priorities are restored on teardown, and root font/resize changes still refresh the affected layout.
- **Boundary:** The benchmark uses synthetic cards on an actual old browser engine, not the shop's physical SUNMI. Its timings demonstrate the layout hotspot and do not certify hardware FPS, network latency or paper delivery.
- **Authorization:** The owner's request to make the application faster and restore product selection.

## Wide native terminals share the browser's back-office frame

- **Date:** 2026-11-18.
- **Evidence:** After startup compatibility was restored, the SUNMI D2s screenshot still showed the native 88px full-width header and profile-contained appearance dialog. This was a separate presentation fork: the browser's sidebar identity, inset header and header-anchored appearance popover were never selected on that device. Earlier control-gallery checks did not cover this authenticated shell.
- **Decision:** Extract the browser's existing desktop presentation into `DesktopShellFrame`. Both browser and native back-office screens use it on native viewports matching the existing 1024px landscape breakpoint. The native shell remains mounted and owns Android Back, keyboard, pull-to-refresh, printer and notification lifecycle once. Native mobile, dedicated POS workspaces and the measured Swan1 home/POS layouts retain their existing presentation. Native registered back, refresh and title overrides pass through the shared frame.
- **Layout:** Use the same sidebar store/account slots, breadcrumbs, language, contract, notification and appearance controls as the browser. Scoped native safe-area rules reserve the system strips. A 64px collapsed native rail contains 44px targets; identity labels are explicitly hidden when collapsed. Its sizing/padding override lives in the base layer so important utility rules cannot defeat it. The native pointer resize strip is hidden because the generic native button minimum otherwise covers menu targets; the header's toggle remains available.
- **Navigation:** Android Back detects open popovers, dropdowns and selects as well as dialogs/sheets, sending Escape to close the current overlay before considering route navigation. Closing overlays are excluded from detection.
- **Appearance:** Selected color/font/background labels use the existing store's state for their classes, with `focus-within` feedback. Their highlights no longer depend on the unsupported `:has()` parent selector in WebView 83.
- **Boundary:** This changes web-delivered presentation and requires no native plugin or financial-operation changes. Browser-engine checks cannot certify the shop's hardware, physical printing or native touch latency.
- **Authorization:** The owner reported the remaining header/theme mismatch and requested browser-equivalent behavior; the previous commit-and-push instruction remains part of this correction.

## The confirmed SUNMI WebView 83 receives a complete native compatibility path

- **Date:** 2026-11-18.
- **Evidence:** The shop's startup diagnostic confirmed WebView 83. The earlier Chromium 88 floor therefore rejected this device. Android 11 alone did not identify its rendering engine.
- **Decision:** Target Chromium 83 JavaScript and retain the independent startup guard. A native ES5 bootstrap supplies the missing `String.replaceAll`; iframe DOM cleanup avoids unsupported `replaceChildren`. Compile the installed PDF, timezone/calendar and chart/Redux dependencies to the same target: their distributed static blocks and logical assignments otherwise fail before a feature can open. Both Webpack caches include the browser target, transpile list and the contents of every local PostCSS compatibility script. Readiness on engines without `:where()` requires a marker emitted only by the new global compatibility stylesheet. Resource load/error capture uses the document, which was verified against real Chromium 83; late CSS must recover without a second React commit.
- **CSS:** Preserve the normal stylesheet and add a native-only CSS3 selector copy behind `@supports not selector(:where(*))`. Keep layer/selector provenance while flattening, then use a fixed six-layer catalog, ID stride and selector offset across every stylesheet; separately compiled unlayered CSS modules must still outrank global base/utilities, with important priorities reversed. Explicitly lower variable-bearing logical declarations, preserve their original selector weight and importance, lower focus/file-input selectors and retain existing alternatives for unsupported `:has()`. Complex negations use explicit startup-screen and public-menu light-ancestor markers. Unknown unsupported negations or specificity-budget overflow fail the build rather than silently changing the cascade. The pure CSS gate also works in PDF clones and Android's JavaScript-disabled print WebView. The verified login stylesheet is approximately 463 KiB gzip.
- **Layout:** Emulate non-inheriting registered-property defaults per element on engines that ignore `@property`, preserving typed zero lengths needed by rings and transforms. Capability-tested native layout support supplies flex gaps on existing items and aspect sizing only on an automatic axis, preserves authored/inline dimensions and auto margins, batches DOM/resize work and restores its inline changes on teardown. Gap calculations use authored CSS expressions instead of animated computed margins, preventing growth during reduced-motion transitions. Refresh scopes include outside gap owners so changing a nested control cannot strip its row's spacing. Wrapped flex lines may retain a leading gap margin; container backgrounds, borders and hit targets are not shifted by negative margins. CSS modules inherit the global resets and keep native host classes global while preserving their local selectors. Card headers create a second column only when an action actually needs it. Standalone print documents supply CSS-only flex-spacing alternatives.
- **Vendor styles:** Compile the installed official Sonner and Vaul styles with the same cascade as the app. Otherwise the lowered reset can outrank their later runtime-injected styles and remove toast padding/borders or drawer-handle sizing. The existing `patch-package` workflow removes one invalid, already browser-ignored selector block from Vaul 1.1.2's standalone stylesheet so strict compilation also works outside production optimization; its runtime behavior is unchanged.
- **Validation boundary:** Verification uses an official Chromium 83.0.4103.0 Mac snapshot through Rosetta, with raw CSS and actual missing browser APIs. The browser test tool receives an in-memory feature check for its own unsupported `checkVisibility` call; the application page receives no fake browser APIs. These checks improve engine coverage but do not certify the SUNMI GPU, camera, native document provider or physical printer. Native plugin code is unchanged, so this web correction reuses the existing Android 1.0.9/build 10 artifact.
- **Validation:** All 3,734 unit tests in 295 files, twelve deployment fixtures, typecheck, lint and a cold production build passed (five existing lint warnings). Genuine Chromium 83 passed six startup/recovery cases plus two final login visual checks, fourteen isolated payment scenarios and four shared-control profiles covering 24 palettes/360 contrast measurements. Chrome 157 passed two browser profiles covering twelve palettes/180 measurements. All six control profiles exercised twenty control families without page/console errors or external requests; minimum measured contrast was 4.679:1. Actual-engine checks also verified eight cross-sheet priority cases, six standalone print layouts and stable icon/control geometry across 120 frames and repeated toggles. All 1,991 compiled client chunks passed the Chromium 83 syntax audit. Local build ID: `FQL6VQQ2IxE2EIxGr8YQm`.
- **Authorization:** This corrects the same requested SUNMI fix after the user supplied its actual engine version; the user's commit-and-push instruction remains part of that work.

## Native Android shares the browser UI with capability-based compatibility and explicit file delivery

- **Date:** 2026-11-18.
- **Context:** The owner requested browser-equivalent behavior across the SUNMI POS app after the green startup screen, including readable colors, working controls, exports and printing. The device is Android 11; its installed WebView version and physical behavior could not be inspected remotely.
- **Styling:** Keep the shared Tailwind/shadcn UI and generate native-only fallbacks for modern color values, color mixes, cascade layers, individual transforms, viewport units and selected `:has()` layouts. Capability guards retain the normal stylesheet on capable engines. Geometry and color animation aliases compose before the cascade-layer polyfill. Registered transform components prevent inherited dialog offsets and invalid scale values. Shared destructive, warning, hover and dark-violet link text tokens also meet the checked contrast threshold.
- **Color trade-off:** Static modern colors are converted at build time. Dynamic mixtures use premultiplied sRGB channel fallbacks on older engines, so a blended tint can differ slightly from a modern OKLCH rendering. Semantic tokens, all six themes and light/dark modes remain the authority; a second UI kit or per-page palette is not introduced. The complete compatibility stylesheet adds approximately 158 KiB compressed versus the same source without these compatibility transforms.
- **Runtime:** Preserve Next's built-in runtime polyfills, replace unguarded UUID generation, provide clipboard copying inside active dialog focus scopes, handle scanner startup failure, and transpile the lazy `html2canvas-pro` dependency to the same browser baseline. The client Webpack cache version now includes Browserslist and `transpilePackages`, preventing a successful incremental build from retaining unsupported syntax.
- **Files:** Android 1.0.9/build 10 adds a bounded PDF/XLSX/PNG/ZIP byte-transfer bridge and an explicit Android document picker. Private staged files expire, MIME/signature and workbook checks reject invalid content, and account/branch/view changes cancel stale transfers. Scope cleanup runs synchronously during React commit, closing the stale-view window before passive effects. Cancellation never reports a saved file. Existing Android PDF support remains a bounded fallback on older installed builds; other unsupported native file types require an app update. Browser downloads retain their existing behavior.
- **Printing:** Prepared report HTML uses Android PrintManager with A4 orientation/color options. Guarded reports probe the cancellation capability before sending HTML, requiring the updated plugin on older installations; legacy print callers keep their existing API. A request UUID permits cancellation while a bounded native WebView prepares the document. A confirmed PrintManager handoff is the boundary: subsequent cancellation never claims to stop an OS-owned job or starts another job. Native preparation has a timeout and pending-count limit. Printer-role selection and durable queue identities remain authoritative. A second transport is permitted only for confirmed pre-queue report failures or explicit `safe_not_queued`; queue exceptions and unknown delivery never trigger an automatic second print. Table QR printing retains its configured queue-only policy because its fallback response cannot prove that no job was queued.
- **Release boundary:** Web changes require deployment, and the new file bridge requires an Android update. Version 1.0.9/build 10 release APK and AAB were built locally with the existing signing configuration; APK/AAB signatures were verified and the release APK is not debuggable. A separate debug APK is retained for testing. No artifact was installed or published, and no production financial write or physical print was performed. Camera permissions, the document picker/provider, device GPU, touch latency and paper output still require acceptance on the shop device; simulated CSS capabilities are not a substitute for an actual old WebView engine.
- **Validation:** Production build, typecheck and lint completed (five existing unused-variable warnings); all 3,688 unit tests in 292 files passed, including twenty SystemPrint bridge lifecycle cases. Gradle unit tests and debug/release APK plus release AAB tasks completed; all 21 Java tests passed (eight new export-store cases, twelve existing PDF-store cases, one example test). The actual payment workflow passed twelve isolated browser scenarios covering free/paid orders, split bills, retry identity and stale tender reset without contacting production. Nine browser/native capability profiles passed all 54 theme configurations and 810 text-contrast measurements (minimum 4.679:1), including shared dialogs, menus, Command and clipboard focus behavior. No browser errors or external requests occurred. All 1,991 compiled client chunks parsed without class static blocks, private-brand checks, top-level await or RegExp `d`/`v` flags. The final production build ID is `ZmAYjQ-rss6qFTuj5qDxR`.
- **Authorization:** The user explicitly requested implementing the fix and broad compatibility work; the shop device cannot be connected by USB.

## Native POS startup supports older WebViews without exposing the green shell

- **Date:** 2026-11-18.
- **Context:** A SUNMI D2s PLUS on Android 11 displayed a green background and the loading shell's empty list bullets. Its exact WebView version was unavailable. The production stylesheet kept the reset/layout inside cascade layers; the initial framework bundle also contained class static blocks unsupported by some older WebViews.
- **Decision:** Include Chromium 88 in the JavaScript build targets. Retain the normal stylesheet and generate a native-only cascade-layer polyfill under `@supports not (color: revert-layer)`, preserving layer specificity and important-rule order. The independent startup error screen is excluded from that polyfill. Initialize Android compatibility and the saved theme directly from HTML, before Next's runtime is required.
- **Recovery:** Native Android startup has a bounded, independent loading guard. A committed React provider and a loaded main stylesheet together dismiss it; late CSS can recover without another React commit. Missing startup assets or a timeout show a readable retry screen. Engines older than the compatibility baseline show an update message. Retry is user initiated and never clears sessions or resubmits business operations.
- **Trade-off:** The conditional compatibility CSS increases the compressed stylesheet size. Modern engines keep their original cascade. This is a startup compatibility improvement, not certification of every feature on Chromium 88 or of the physical SUNMI device; its actual engine version and device acceptance remain to be verified.
- **Build cache:** Next 16's client Webpack cache does not include Browserslist in its version. After changing browser targets, rebuild with a fresh client compilation cache; otherwise cached framework code can retain unsupported static blocks.
- **Validation:** Typecheck, production build and lint completed; all 3,600 unit tests passed. Five isolated Chrome scenarios covered normal Android startup, simulated loss of cascade layers, an unsupported engine, failed startup assets with manual retry, and a mobile browser. The 32 referenced login startup chunks contained no class static blocks after a fresh client build, and the independent inline guard parsed as ES5. The compressed main stylesheet increased by approximately 89 KiB.
- **Authorization:** The user explicitly requested implementing the fix after reviewing the device information.

## Issued commercial documents support explicit versioned edits

- **Date:** 2026-11-14.
- **Decision:** A saved quotation or receipt can be reopened from a fresh backend snapshot and edited under its existing UUID and number. Every successful update creates an immutable audit revision with the actor and timestamp. Updates require the loaded `expected_version` and an idempotent operation UUID; conflicts preserve the user's draft instead of overwriting a newer version.
- **Boundary:** Editing affects one document. A linked receipt retains its own values and pinned source quotation number/version until separately edited. Existing line identities preserve original item prices, names and images even after catalog changes or deactivation; newly added lines still follow current catalog access. History snapshots are read-only. Cached newer versions and permanent receipt links cannot be demoted by older responses.
- **Discount:** The optional document-level LAK or percent discount is applied before VAT. Blank or zero values omit its row from preview, printing and PDF. A positive entered percentage remains visible even if its rounded LAK discount is zero.
- **Retry:** Identical failed update attempts reuse their operation UUID; changing the attempted payload creates a new operation while retaining the loaded expected version. An ambiguous create failure locks the original attempted content until retry recovers the issued document, so later edits cannot be silently discarded or create an accidental second issue.
- **Authorization:** The user explicitly requested editing already-issued documents and an optional footer discount that appears only when entered.

## Commercial catalog ownership is independent of document destinations

- **Date:** 2026-11-14.
- **Decision:** Commercial catalog items, prices and photos belong to the authenticated actor's store through `catalog_store_uuid`. They are saved once and reused across every document destination that actor is authorized to manage. PLC operators retain their own catalog when selecting customer stores, while customer-store users retain their own tenant catalog. Selected store/branch controls affect document creation and history; quotations and receipts remain target-branch scoped immutable snapshots.
- **Reason:** The owner clarified that managing another branch must not require entering the same price list and photos again. Catalog creation-branch provenance is insufficient as an ownership boundary for this workflow.
- **Access:** Roles 1 and 2 can change shared catalog data; role 3 can read it and issue documents for its authorized branch. The server derives ownership from the live authenticated actor, and the frontend rejects a whole wrong-owner response instead of silently hiding individual rows. Catalog requests retain an authorized target branch as context, never as ownership authority.
- **Lifetime:** Same-owner destination changes retain catalog state and reset document state. Session/owner changes invalidate catalog work; stale document responses cannot populate a new target. Existing issued item/image snapshots are preserved when catalog data changes.
- **Authorization:** The user's correction in this conversation: save the catalog once and reuse it across all stores and branches the operator can manage.

## Commercial A4 documents follow the selected system font

- **Date:** 2026-11-14.
- **Decision:** Commercial quotations, payment receipts and price lists use the current `app-store` `laoFont` choice in preview, browser printing and PDF downloads. Their isolated iframe loads the existing approved local font files through `public/fonts/app-document-fonts.css`; Latin text and figures use Noto Sans.
- **Reason:** The owner explicitly requested the system font after reviewing a quotation rendered with the legacy Saysettha/Times receipt stylesheet. An iframe cannot inherit the parent page's `next/font` classes or appearance attribute.
- **Boundary:** This supersedes the fixed-export-font trade-off only for the commercial A4 workspace. Restaurant receipt/kitchen printing and existing report exports keep their current font contracts.
- **Authorization:** The user's request in this conversation: use the system font and improve the document table lines.

## Browser billing documents use the Auto Print raster

- **Date:** 2026-11-06.
- **Decision:** Safe, explicitly unqueued browser invoices and receipts carry PNG strips produced by the Backend's existing document formatter and raster renderer. The print window displays those strips at the configured paper width and physical dot scale. Browser code does not recreate financial labels, totals, item layout, credit rules or fonts for these documents.
- **Reason:** The owner requested the same output as Auto Print. The independent HTML layout had drifted in money formatting, topping quantities, credit headings and customer details. Sharing the prepared raster keeps the existing Auto Print template authoritative instead of maintaining a second layout.
- **Boundaries:** Existing role selection, transport, queue identities, payment commits and reprint drawer rules stay authoritative. The browser path still requires a saved API snapshot and `safe_not_queued`; it never substitutes cached carts, starts a second physical job or resubmits payment. Rendering errors are visible even when separate kitchen jobs succeed.
- **Limits:** PNG size, dimensions and strip count are bounded. Without an available document printer profile the default is 80 mm. Browser print settings and the chosen driver still control output scale, margins, cutting and hardware actions; opening a preview is not proof of paper delivery.
- **Authorization:** The user explicitly requested invoice and receipt printing to match Auto Print in every applicable detail.

## Printer management visibility follows verified owner access

- **Date:** 2026-11-06.
- **Decision:** The printer management page defaults to this device's printers, LAN printers with a freshly verified owner, and configured INTERNET printers. A separate all-saved view preserves the authenticated branch's settings catalog and existing private-device ownership boundary. A dedicated presentation store holds this catalog and its observations; the operational printer store and automatic kitchen/document selection stay unchanged.
- **Verification:** A bounded, credentialless GET to the saved private IPv4 owner Agent's `/health` must return both the exact Agent ID and device code. Matching IP prefixes, a saved identity or a server heartbeat alone cannot confirm a foreign owner on the current connection. Failed, blocked or mismatched reads remain unconfirmed and can be inspected in the all-saved view. Manual LAN test controls are unavailable until verification; no verification request sends printer bytes.
- **Lifetime:** Evidence is not persisted. Wake, focus, online and periodic refresh clear it before reading the current Agent and catalog again; user/branch/device changes and logout discard old observations.
- **Limits:** A confirmed owner Agent is not proof of physical printer readiness. A connected owning terminal remains its own device; identifying a physical site after that same owner moves to an identical private network would require a separate site/router identity. Browser private-network or CORS restrictions leave a peer unconfirmed rather than inventing a successful check.
- **Authorization:** The user explicitly selected hiding nonlocal LAN entries only from the list, retaining INTERNET visibility and automatic routing, then requested implementation.

## Browser invoice and receipt printing without a configured printer

- **Date:** 2026-11-06.
- **Decision:** Ordinary browsers may print invoices and receipts through a reserved `window.open` preview when Backend returns an authoritative document snapshot explicitly marked `safe_not_queued`. A popup blocked by the browser can be reopened from the same prepared snapshot. Native and Electron transport capability rules remain authoritative.
- **Reason:** The owner requested browser printing when no printer is connected. Backend prepares the bill, payment, currency and credit values; cached cart data cannot replace failed preparation. Receipt printing happens after payment commits and never resubmits payment.
- **Duplicate protection:** Queued physical jobs keep their existing delivery/recovery path. Missing receipt-role configuration may accompany kitchen jobs; only the unqueued receipt opens in the browser. Ambiguous retries of the same invoice operation and payment replays do not automatically start browser printing. Backend checks existing durable print identities before allowing a no-printer fallback.
- **Result semantics:** Opening the browser print window reports an informational preview-opened result, not proof that paper was printed. The cashier selects a system printer or PDF in the browser dialog.
- **Authorization:** Explicit user request to support `window.open` printing for both receipts and invoices when no printer is connected.

## Branch contract expiry applies to every staff branch

- **Date:** 2026-10-29.
- **Decision:** Own-branch navbar expiry is visible to every store classification and employee role. The backend rejects new staff logins and existing staff JWTs after the branch contract end date in `Asia/Vientiane`. Null contracts remain undated and the end date itself remains usable. Contract management permissions stay PLC-only.
- **Reason:** The user requested expiry visibility for every branch and automatic sign-out until payment/renewal. The existing live session lookup is the authority, avoiding stale JWT claims or browser-clock decisions. Account activation remains a separate manually managed status so renewal can restore access without reactivating staff accounts.
- **Renewal:** A public expired page uses existing YummyGo contact channels. No subscription payment gateway exists in the repository; access resumes only after an authorized manager records renewal and the server accepts credentials again.
- **Scope:** Staff password login and JWT-protected APIs. Public customer QR and socket subscriptions use independent access paths. See `docs/BranchContractExpiry.md` for the contract and verification.
- **Authorization:** Explicit user request to show expiry to all branches and block sign-in/expire existing sessions until renewal.

## Read-only live restaurant alongside isolated 3D training

- **Date:** 2026-10-29.
- **Decision:** The simulator window defaults to an authenticated live restaurant view; training remains an explicit separate mode. A dedicated SELECT-only backend read model returns current authorized table and open-order state. Its own Zustand slice has no command actions or browser persistence. Foreground polling every 10 seconds is bounded and cancelled on inactivity, scope changes and teardown.
- **Reason:** The user requested that orders placed by real customers appear in the 3D restaurant. Combining production orders with the training command model would make data and action boundaries ambiguous. Dedicated reads preserve current branch/zone authorization and keep the existing training workflows isolated.
- **Alternatives considered:** Existing POS readers have different manager/branch semantics, and the queue reader does not apply assigned-zone filtering. Existing branch Socket.IO subscriptions are unsuitable as the authority for this scoped data. Bounded authenticated polling provides predictable coverage without changing production realtime infrastructure.
- **Limits:** Illustrative room/people, no physical tracking or fabricated guest count; 400 tables/orders and 4,000 lines per snapshot, visible truncation warning, up to 80 tables in the scene with selection retained. Live view has no order, kitchen, payment, stock or printer writes.
- **Authorization:** User explicitly requested real customer orders to be mirrored and asked to continue implementation.

## Online restaurant simulator and browser verification

- **Date:** 2026-10-27.
- **Decision:** The simulator is a separate `/simulator` window with its own non-persistent Zustand domain, an Axios service under `/api/v1/simulator`, and an additive PostgreSQL session/operation store in the Node backend. Existing POSAll pure calculation, status, category, stock, currency, modifier, and printer-policy helpers remain authoritative. Simulation code never invokes production transaction routers or printer/payment transports.
- **3D:** React Three Fiber 9 and Drei 10 use the existing React 19/Three.js installation. Only the simulator route dynamically imports the renderer. Procedural models require no external assets or paid services.
- **Localization:** A scoped i18next instance supports Lao, Thai, and English inside the simulator; the main application's Lao/English API-language and preference contracts remain unchanged.
- **Verification:** Playwright is a development dependency for the user-requested end-to-end tests. `npm run test:simulator:e2e` launches a temporary Next checkout and a real Express simulator router with PostgreSQL-compatible PGlite fixtures. It uses synthetic authentication, rejects external requests, never imports production DB configuration, and never contacts production. Existing Vitest remains the pure-logic runner; no component test environment is added.
- **Authorization:** The user explicitly requested this isolated online simulator, its named feature branch, the specified open-source 3D libraries, and automated/end-to-end verification. No production deployment or live migration is part of these local implementation checks.

Append-only. Add an entry whenever a Non-negotiable in `CLAUDE.md` (or a rule in `Rules.md`/`Architecture.md`) is deliberately overridden, or a real trade-off gets settled instead of relitigated every time it comes up. Newest first.

Entries below dated from git history are backfilled from existing code comments at doc-generation time (2026-09-01) — `date` is the file's last-touched date in git, not necessarily when the decision was first made, and `approved by` is unrecorded. Both are marked `TODO(owner): confirm` where the original author/date isn't recoverable from the repo.

---

## User-selectable Lao font: Noto Sans Lao (default), Noto Serif Lao, Phetsarath OT, Saysettha OT

- **Date:** 2026-10-22.
- **Context:** The owner asked to add Phetsarath OT, Noto Serif Lao and Saysettha so that each user can pick the Lao typeface they prefer. Design.md / Non-negotiable #8 allow only the approved fonts in `src/design-system/fonts.ts`, so this extends that approved set rather than adding fonts in feature code.
- **Decision:** All four faces are registered through `next/font/local` in `src/design-system/fonts.ts`:
  - Noto Serif Lao (variable) and Phetsarath OT (Regular + Bold) were downloaded from `github.com/google/fonts`. Both are SIL OFL 1.1, and `OFL.txt` sits next to each file in `public/fonts/`.
  - Saysettha OT reuses the existing `public/fonts/saysettha_ot.ttf`, which the receipt CSS already ships.
  - The three optional faces use `preload: false`.

  A new token, `--font-lao-ui`, set per `html[data-lao-font]` in `globals.css`, now backs `font-lao`, `--font-heading`, `--font-mono`, the body font and toasts. The user picks the face under Appearance → Lao font (`app-store` `laoFont`, persisted). The theme bootstrap script applies it before first paint.
- **Trade-off:** Printed and exported surfaces (report print surface, menu PDFs, receipts) keep their own fixed faces. Saysettha OT has a single 400 weight, so bold text in it is synthesized. Fonts a user has not chosen are not downloaded on normal pages. Opening the appearance picker does fetch all four, because each option previews itself (about 0.4 MB once, then cached). Latin text and figures stay on Noto Sans in mixed UI text (`font-heading` lists `--font-sans` first).
- **Approved by:** repository owner (2026-10-22, in conversation: "download and add font … ໃຫ້ user ສາມາດປ່ຽນ font ໄດ້").

---

## Dashboard redesign: CSS "banknote plate" hero, no WebGL, no new dependencies

- **Date:** 2026-10-22.
- **Context:** The owner asked for a dashboard (`/`) that is modern, impressive and "grand" instead of dull. Libraries were allowed, and 3D was allowed "only where it fits". Four design directions were scored by three judges (brief fit, platform constraints, implementability). The page is also the home screen of the Swan 1 terminal (RK3566, Android System WebView 101, 1920×1080), which keeps it open all day.
- **Decision:**
  - **Hero.** The revenue hero is a CSS-only "banknote plate". It is `bg-primary` with neutral `--dash-*` overlays, so all five `data-theme-color` presets work in light and dark. On top sit a generated guilloché SVG (`dashboard-engraving.ts`), an odometer that rolls each digit with `transform` only, a condensed Noto Sans numeral (`font-stretch`), and a skyline with one column per day (per week or month once the period passes 62 or 400 days, `bucketTrendRows`) in which the owed part is hatched.
  - **Cards below the hero.** The ledger becomes a receipt with a gross-to-net bar per line. Channels become lanes that compare revenue share with order share. Tables become a seat grid. Insights become ticket stubs.
  - **3D and motion libraries.** No three.js or WebGL on the dashboard, and `motion` is not imported on this route.
  - **Motion tiers.** Motion is CSS/tw-animate, tiered by `visualEffectsTier()` (`src/lib/visual-effects-tier.ts`):
    - *static* on Swan 1, on old Android WebViews and under reduced motion;
    - *lite* on other Android devices, touch screens and Save-Data users;
    - *full* on desktop and Electron.

    A `[data-fx]` kill switch in `globals.css` stops entrances, odometer rolls and meter fills on Swan 1. The first-load skeleton still shimmers there as loading feedback, as POS spinners do.
  - **recharts.** It is fetched only for a range longer than one day that has sales rows, so the default "today" view never loads it.
  - **Tokens and utilities.** New tokens `--dash-sheen`, `--dash-shade`, `--dash-engrave`, `--dash-card-shadow` and `--dash-plate-shadow`. New `@utility` patterns `bg-dash-plate`, `bg-dash-notches`, `bg-perforation` and `bg-hatch`. `dashboard-platform-guard.test.ts` keeps WebView-101-breaking classes out of the dashboard: unguarded oklab gradients, the individual `translate`/`scale`/`rotate` properties, `color-mix()`, bare `dvh` and container queries.
- **Why no 3D:**
  - three@0.185 is about 188 KB gzip (`three.module.min.js` 87 KB plus `three.core.min.js` 101 KB, measured).
  - The existing burger gate would let Swan 1 through: it reports 4 cores.
  - The default "today" view has a single data row, so a data-true 3D chart would be empty on the routine open.
  - Perspective distorts money comparisons.
  - A WebGL lifecycle cannot be covered by the Vitest-only test gate.
- **Trade-off:** There is no 3D "wow" moment. If the owner still wants it, it ships as its own change behind a separate gate:
  - not on Capacitor Android or Swan 1;
  - desktop only, with a fine pointer;
  - at least 7 days in the period;
  - `deviceMemory` and `hardwareConcurrency` of 8 or more, failing closed when unknown;
  - a WebGL2 probe with `failIfMajorPerformanceCaveat`;
  - render-on-demand, plus its own boundary test.
- **Also changed, app-wide:** `.skeleton-shimmer` used a raw `color-mix()`, which WebView 101 drops, so skeletons were invisible on Capacitor Android. It now has `rgba()` fallbacks under `html.capacitor-android`. New `la` strings under `dashboard.*` still need native-speaker review.
- **Approved by:** `TODO(owner): confirm`. The agent proposed this under the owner's "3D only where it fits" instruction (2026-10-22).

---

## QR menu gets its own light/dark toggle, independent of the POS theme

- **Date:** 2026-10-05.
- **Context:** Commit `630a234d` (2026-10-02) removed the QR menu's theme switch and forced light (`data-yg-theme="light"`) because the old switch reused the POS theme (`useAppStore().theme` → `.dark` on `<html>`), so toggling it on a shared device also flipped the cashier's POS. The owner asked for a dark-mode icon in the QR menu header again. Separately, shadcn primitives' `dark:` variant keyed only on `<html class="dark">`, so a device in dark mode rendered dark-mode primitive styles on the forced-light menu (the waiter drawer showed a transparent active tab and an invisible switch).
- **Decision:** The QR menu stores its own theme (`yummy-go:public-pos-theme`, default light, `src/features/public-pos/order/public-pos-theme.ts`) and sets `data-yg-theme` on `<main>` and `<body>`; it never touches `<html class="dark">`. `nightfall.css` applies the Nightfall dark tokens for `[data-yg-menu][data-yg-theme="dark"]` too. The app-wide `@custom-variant dark` in `globals.css` now also matches inside `[data-yg-theme="dark"]` and is suppressed inside `[data-yg-theme="light"]`, with `:where` in the `:not()` so specificity stays (0,1,0) and the cascade elsewhere is unchanged.
- **Trade-off:** One more piece of client state per device. Pages without `data-yg-theme` behave exactly as before.
- **Approved by:** repository owner (2026-10-05, in conversation — "add icon darkmode in header").

---

## Report row pinning moves to its own pin toggle; first row and primary column pinned by default (supersedes the entry below)

- **Date:** 2026-09-30.
- **Context:** A review of the report tables found the checkbox-pins-row coupling (entry below) causing real bugs: un-ticking one row after "select all" suddenly froze 4–5 rows, rows past the 40% height budget silently didn't pin (reported by the owner as "why not lock?"), and pinning a row to compare it narrowed summary/export. The owner also wanted the first row and first column locked by default so the feature is discoverable — which, with the coupling, would have pre-selected the first row and made every default export contain one row.
- **Decision:** Row pinning uses a separate pin toggle (`ReportRowPinToggle`, `[data-row-pin][aria-pressed]`) next to the selection checkbox; selection no longer affects pinning. Column pinning uses the same pin-icon toggle instead of a checkbox so the two controls are distinguishable. Defaults: the first row of each loaded data set is pinned until the user unpins a default row once (remembered device-wide in `localStorage`), and each report's primary column (first `hideable: false` option) is pinned until the user sets their own pins (an empty choice is stored as `"[]"` so it sticks). Pin toggles stay hidden until hover/focus (faint on touch screens) because the defaults already show the feature. A row that exceeds the 40% height budget stays pressed but faded, and pinning it shows a "locked rows are full" toast.
- **Trade-off:** One extra small control per row. Default pins are opinionated — a user who never wants them must unpin once per device (rows) or once per report (columns).
- **Approved by:** repository owner (2026-09-30, "fix all" on the review that proposed this).

---

## Report row selection checkbox also pins the row vertically (superseded above)

- **Date:** 2026-09-30.
- **Context:** Report tables got column pinning (header checkbox → column stays left on horizontal scroll). The owner asked for the vertical equivalent driven by the existing row-selection checkbox in the order column. That checkbox already filters the summary, Excel export and print to the selected rows (`use-*-report-workflow.ts` → `selectedRowIds`). The agent objected once: one control would carry two intents, so selecting rows for export also freezes them, "select all" would pin every row, and pinning a row to compare it silently narrows the export. A separate per-row pin toggle was offered and declined.
- **Decision:** A selected row (`tr[data-state=selected]`) sticks under the table header while scrolling vertically (`src/features/report/shared/report-sticky-table.ts`). Two guards limit the damage: a fully checked "select all" pins nothing (indeterminate still pins), and pinned rows stop at 40% of the scroll area's height (`MAX_PINNED_ROW_SHARE`) — later selected rows scroll normally.
- **Trade-off:** Selecting rows to export still freezes up to ~40% of the table, and a user pinning rows to compare will narrow summary/export to those rows. Revisit with a separate pin control if cashiers report exporting partial data by accident.
- **Approved by:** repository owner (2026-09-30, in conversation, after the objection above).

---

## Non-negotiables 5 and 7 rewritten after the online-only cutover

- **Date:** 2026-09-30.
- **Context:** A docs audit found two Non-negotiables in `CLAUDE.md`/`AGENTS.md` describing code that no longer exists. #5 justified `--webpack` with `@serwist/next`'s InjectManifest, but Serwist is no longer a dependency. #7 required `src/lib/offline-routes.ts` and `src/services/offline-sync.ts` to change together, but both files were deleted in the 2026-09-14/09-24 offline removal.
- **Decision:** #5 now keeps `--webpack` on a different basis: a Turbopack production build is unverified against Electron standalone staging and the VPS deploy, so switching needs its own entry here. #7 is replaced by the invariant the cutover actually established: no local fallback for sales, cart, kitchen, or payment.
- **Trade-off:** `--webpack` stays even though its original reason is gone, which costs slower builds until someone verifies Turbopack end-to-end. Dropping it silently was rejected because a bundler swap touches all three ship targets at once.
- **Approved by:** `TODO(owner): confirm` — proposed by the agent on 2026-09-30, pending owner review of the diff.

---

## Remove the retired local-sales implementation; printing uses printer acknowledgements without pacing timers

- **Date:** 2026-09-24.
- **Context:** After the online-only cutover, the owner confirmed there is no remaining offline operating mode and asked to remove every active local-sales surface. The same production report showed print progress reaching `N/N` before paper was emitted, while timer-based pacing made receipt, kitchen-slip and payment printing unnecessarily slow.
- **Decision:** Delete the retired Frontend local database/queue/recovery pages and modules, remove the Backend branch toggle, sync API and legacy print-proof paths, and remove Printer Agent local sync routes/schedulers while retaining historical migrations and one-way upgrade cleanup. Raw TCP printing now streams the whole batch without artificial inter-ticket/final-drain sleeps and places an ESC/POS `GS r 1` status query after every cut. Progress advances in cut order only when each printer response arrives. Receipt and payment documents use the same acknowledgement rule. Windows/CUPS paths report operating-system spool acceptance because those APIs do not expose physical paper-exit acknowledgement.
- **Trade-off:** A Backend outage cannot be treated as a successful local sale and no local order can be queued for later replay. Printer acknowledgements prove the device accepted/emitted each cut boundary, not that a human physically collected the sheet. Historical audit rows and migrations remain intact so upgrades and completed-sale history are not corrupted.
- **Approved by:** repository owner (2026-09-24, in conversation — explicitly requested removal of the timer and all active offline behavior while keeping printing fast and correct).

---

## Disable pinch-zoom on staff-only routes (overrides WCAG 1.4.4 resize-text floor)

- **Date:** 2026-09-18.
- **Context:** On Capacitor iOS, tapping any text input auto-zoomed the WKWebView (WebKit heuristic for `<input>`/`<textarea>` with computed font-size < 16px) and the zoom did not reliably reset after blur — a known WKWebView bug, not something fixable purely by waiting or listening for blur. A first fix (forcing `font-size: 16px` on inputs inside `.capacitor-ios`, see `src/app/globals.css`) removes the *trigger* without touching zoom capability at all, and stays in place. The owner additionally asked to disable pinch-zoom outright rather than rely on that alone. An app-wide version of this (set on the root `src/app/layout.tsx`) shipped first, then was caught by code review: the root layout covers every route including `src/app/posAll` — the public QR-ordering page customers open on their own phones — so it was silently disabling zoom for customers too, which the reasoning below never intended.
- **Decision:** `src/app/(protected)/layout.tsx` (the authenticated staff route group — `order_manage`, `products`, `settings`, the staff-side `posAll`, etc.) sets its own `viewport` export with `maximumScale: 1, userScalable: false`. Next.js merges nested `viewport` exports per key, so this only adds the zoom lock for that subtree; the root `src/app/layout.tsx` keeps its original `viewportFit: "cover"` with no zoom restriction, so `login`, `customer-display`, `policy`, and the public `src/app/posAll` all stay pinch-zoomable.
- **Trade-off:** This overrides the WCAG 1.4.4 (resize text, AA) floor recorded in `docs/Design.md` > Accessibility floor, but only for the `(protected)` route group — a staff member who needs to pinch-zoom to read small text there can no longer do so. Accepted because every device reaching those specific routes is a shop-owned tablet/terminal operated by staff, not a personal device (this claim is now actually scoped to routes where it holds); an accidental mid-shift zoom that then gets stuck (the original bug) was judged a worse everyday failure mode than losing pinch-zoom on this device class. If a genuinely low-vision staff member needs larger text, use the in-app font-scale setting (`src/stores/app-store.ts`, `FontScale`) instead of OS-level pinch-zoom. The public ordering page a customer opens on their own phone keeps full pinch-zoom, since the rationale above never applied to it.
- **Approved by:** repository owner (2026-09-18, in conversation, after this trade-off was raised and pushed back on once; the app-wide scope was further narrowed same-day after code review caught it hitting the public ordering page).

---

## Frontend POS pages use the POS All route namespace

- **Date:** 2026-09-15.
- **Context:** After retiring the Backend `/api/v1/pos/*` namespace, the owner directed the browser page URLs to use the same POS All naming so `/pos`, `/pos/order`, and `/pos/tables` can be removed completely.
- **Decision:** Move the public page to `/posAll`, the cashier page to `/posAll/order`, and table selection to `/posAll/tables`. Update navigation, offline shells, QR fallbacks, static assets, and tests together. Stable printed `/q/[token]` links now redirect to `/posAll?t=:token`.
- **Trade-off:** Direct bookmarks to the retired `/pos*` browser paths return `404`; clients must use the POS All routes. Existing printed `/q/[token]` QR codes remain valid.
- **Approved by:** repository owner (2026-09-15, in conversation).

---

## POS All is the only Backend sales API namespace

- **Date:** 2026-09-15.
- **Context:** The owner confirmed that the old POS implementation is no longer used and directed future work to target POS All only. A repository audit found no Frontend or Printer Agent request to `/api/v1/pos/*`; all current staff, public QR, kitchen, payment, report-print, and credit requests use `/api/v1/posAll/*`.
- **Decision:** Remove the legacy Backend POS router and its tests, move the remaining credit routes from `/pos/credit/*` to `/posAll/credit/*`, and prohibit restoring or modifying the retired `/api/v1/pos/*` API. Frontend pages were subsequently moved to `/posAll*` by the decision above.
- **Trade-off:** Any untracked old client that still calls `/api/v1/pos/*` now receives `404` and must upgrade. Keeping silent aliases was rejected because it would preserve two production API surfaces and allow routing/payment behavior to drift again.
- **Approved by:** repository owner (2026-09-15, in conversation).

---

## All stores use Online-only sales; every old offline queue is retired globally

- **Date:** 2026-09-14.
- **Context:** Multiple devices at the same table showed different totals, local dependency chains remained blocked, and QR/payment/return printing stopped behind old offline work. The owner explicitly chose not to recover any remaining queued intent and requested a safe all-store removal with no future offline order queue.
- **Decision:** POS authentication, reads and business mutations now call Backend only. Backend never dispatches a new `/sync/push` mutation; during the compatibility window it authenticates old clients and acknowledges their submitted events as discarded/SYNCED so old outboxes can drain without replaying stale sales. Browser startup removes the retired Dexie database, offline storage markers, Cache Storage and service-worker registrations. A tombstone worker retires already-installed workers. Printer Agent 1.0.11 archives then deletes unfinished local sync/print rows once and no longer starts the local sales-sync or offline-print schedulers; its online `/print-ops` transports remain active.
- **Global cleanup:** The one-time Backend migration archives every non-SYNCED `tb_sync_event`, deletes those rows from the live sync queue, archives every pre-cutover pending/partial/failed print job with its item snapshots, marks those old jobs skipped, and disables `offline_mobile_enabled` on every branch. Successful orders, payments, successful print history and Agent PRINTED dedupe rows are not deleted.
- **Trade-off:** A shop cannot login, sell, confirm kitchen work or pay while Backend/internet is unavailable; the action must fail visibly and be retried online. A physical printer that is unavailable can still create a normal Backend print failure, but it cannot create or replay a local order/payment. Reintroducing offline sales requires a new explicit decision and a new contract version.
- **Approved by:** repo owner (2026-09-14, in-conversation — explicitly requested no recovery, global pending cleanup and complete Offline removal).

## Retryable mobile print jobs follow an edited TCP endpoint, but uncertain jobs stay frozen

- **Date:** 2026-09-14.
- **Context:** Sethathirath Hospital changed one Wi-Fi printer from `192.168.100.52` to `192.168.100.2`. Backend routing immediately used the new config, but an already-durable mobile kitchen job retained the old endpoint snapshot and therefore held `KITCHEN_CONFIRM` locally before Backend could see it.
- **Decision:** After fetching the current mobile printer configuration, rebind only `PENDING`/`FAILED` local print jobs to the same config UUID. If an older edit recreated the config, allow a fallback only when the printer name uniquely identifies one active TCP config. Rebound `FAILED` work becomes `PENDING` and retries through the durable spooler.
- **Safety boundary:** Never alter or retry `PRINTING`, `UNCERTAIN`, or `PRINTED` work; those states may already have emitted paper. Never guess between duplicate printer names.
- **Reason:** A printer IP is operational configuration and can change while safe, not-yet-sent work is durable. Freezing the old address forever blocks the kitchen event; rewriting delivery-uncertain work could print duplicates.

## Branch queue resets are versioned, device-local, and never delete payments

- **Date:** 2026-09-14.
- **Context:** Sethathirath Hospital accumulated terminal mobile `BLOCKED` rows against already-closed bills. Those rows live in each phone's Dexie database, so deleting Backend audit rows cannot clear the operational queue remotely.
- **Decision:** `GET /sync/runtime-capabilities` can carry a branch-scoped reset version. Each Capacitor device applies a version once, discards its currently blocked non-financial rows, records the applied version locally, and immediately refreshes live data from Backend. Repeated capability polling cannot erase a later rejection because the same reset version becomes inert after its first successful application.
- **Safety boundary:** `PAYMENT` is never eligible for a remote reset. It remains visible for explicit, on-device financial confirmation. Retryable `STAGED`/`PENDING`/`PROCESSING`/`FAILED` work is also retained.
- **Reason:** A Backend-only delete is ineffective because Backend does not own the mobile outbox; an unversioned "clear blocked" flag would silently delete every future conflict forever. A one-shot device-local command clears this incident without weakening future conflict review.
- **Approved by:** repo owner (2026-09-14, in-conversation — explicitly requested immediate queue clearing and no recurrence).

## Branch offline toggle gates entering offline mode at all on mobile, not just writes (narrows "every menu destination is viewable offline")

- **Date:** 2026-09-14.
- **Context:** After the previous entry's toggle shipped as a write-only gate (blocking KITCHEN_CONFIRM/PAYMENT, then broadened same-day to every mutation including add-item), the owner clarified the actual intent twice, in increasingly explicit terms: the switch is "offline to online" itself — off means the device must not be able to enter offline mode at all, on is required first. This is narrower than "Every established menu destination is viewable offline on desktop and Capacitor" (2026-09-08), which made offline reads unconditional for Capacitor.
- **Decision:** On mobile, while `networkState` is confirmed `OFFLINE`, both the Dexie read fallback and the local write fallback now require the branch's `offline_mobile_enabled` flag; a branch with it off gets neither and simply fails like an ordinary online-only app until reconnected. This does not touch the *online* "keep this order's own local ownership while reconnect finishes draining" mechanism (2026-09-07 entry) — that is a data-consistency rule for an order already touched locally, unrelated to whether the branch permits entering offline mode, and must keep working online regardless of this toggle.
- **Also fixed the same day:** an intermediate version of this gate checked the toggle without restricting to `networkState === OFFLINE`, so it also fired during the online reconnect-drain window above — every branch except the one already piloted defaulted the toggle off, so add-item broke while genuinely online for any order with unsynced local history. Caught from a live report within the hour.
- **Boundary:** Desktop (Printer Agent) is unaffected — this flag and this whole code path are Capacitor-only. `OFFLINE_FIRST_MOBILE_DISABLED` remains the separate global kill switch.
- **Approved by:** repo owner (2026-09-14, in-conversation — corrected twice after the write-only interpretation shipped).

## Mobile offline checkout moves from an env-var allowlist to a per-branch DB toggle, default off (supersedes the wildcard entry below)

- **Date:** 2026-09-13.
- **Context:** The day after opening `OFFLINE_FIRST_MOBILE_BRANCHES=*` to every branch (entry below), the owner asked for a proper on/off switch on the branch settings screen instead — "ให้ default ที่ปิด offline ก่อน" (default off) — so enabling a branch never again requires an engineer, SSH, or a GitHub Actions run.
- **Decision:** `tb_branch.offline_mobile_enabled` (migration `20260913_add_branch_offline_mobile_enabled.sql`) is now the source of truth per branch, defaulting to `false` for every branch including new ones. `GET /sync/runtime-capabilities` reads this column instead of the allowlist; `runtimeCapabilities()` takes the resolved boolean directly. `OFFLINE_FIRST_MOBILE_BRANCHES` is no longer read anywhere — a leftover `*` in production `.env` is now inert. `OFFLINE_FIRST_MOBILE_DISABLED` is kept as the only remaining env-based control: a global emergency kill switch independent of any branch's toggle. Settings > Branch exposes the toggle as its own `PATCH /branch/offline_mobile_enabled` endpoint (not folded into the multi-field branch save) so flipping it can never be blocked by unrelated VAT/email/QR validation, and a live-toggle Switch does not wait for the branch form's Save button.
- **Migration note:** The same migration sets `offline_mobile_enabled = true` specifically for the `inthanin` branch (matched by name) so the incident fix from 2026-09-12 does not silently regress back to disabled the moment every other branch defaults to off; every other existing branch starts off and needs an explicit toggle.
- **Safety boundary carried over, unchanged by this entry:** the "not feature-complete" caveats from "Capacitor mobile uses Dexie, never the desktop Agent" (no native durable print jobs/routing proof/receipt renderer) still apply to any branch an owner switches on — the toggle controls exposure, not readiness.
- **Reason:** Restores the original 2026-09-09 decision's intent (opt-in per branch, reversible, no all-store blast radius) while removing the operational bottleneck that made the wildcard tempting in the first place — the owner can now scope this themselves without engineering involvement each time.
- **Approved by:** repo owner (2026-09-13, in-conversation).

## Mobile offline checkout rollout allowlist opened to all branches (reverses the "enable every branch in one release" rejection below)

- **Date:** 2026-09-12.
- **Context:** Store "inthanin" went offline on a mobile device and could not confirm kitchen orders or print. Root cause: `OFFLINE_FIRST_MOBILE_BRANCHES` had never been set in production for any branch, so `mobile.offline_checkout_enabled` fails closed by design (see the entry below). Owner was shown that this fails-closed behavior was a deliberate, recent, self-approved decision, and was offered the safer branch-scoped fix (allowlist inthanin's `branch_uuid` only). Owner initially agreed to that scope, then asked for every branch ("ทุกร้านด้วย") after being told this reverses the decision below's explicit "alternatives rejected: enabling every branch in one release."
- **Decision:** `OFFLINE_FIRST_MOBILE_BRANCHES` is set to `*` in production — the wildcard the allowlist code already supported (previously exercised only by the kill-switch test). No code change; `OFFLINE_FIRST_MOBILE_DISABLED` remains as an immediate full rollback if any branch's mobile checkout misbehaves.
- **Safety boundary carried over, unchanged by this entry:** no additional physical Android/iOS/printer acceptance was performed for branches beyond whatever had already been piloted. The "not feature-complete" caveats in "Capacitor mobile uses Dexie, never the desktop Agent" (no native durable print jobs/routing proof/receipt renderer, dependency extraction pending) still apply to every branch now covered by the wildcard, not just inthanin.
- **Reason:** Owner explicitly reconfirmed wanting it for every store after being told this reverses the prior gradual-rollout decision and the specific reason that decision gave for rejecting a one-shot all-branch release.
- **Approved by:** repo owner (2026-09-12, in-conversation).

## Mobile offline checkout is branch-gated and fails closed

- **Date:** 2026-09-09.
- **Context:** The owner requested practical offline-to-online operation across Windows, macOS, Android and iOS, then explicitly authorized implementation after being told that zero-error/100% certification is not technically honest and that a direct all-store release could affect tills already trading.
- **Decision:** Mobile kitchen/payment uses a v2 contract with an add-only Dexie print queue, atomic sale/print staging, stable sync/stock/print identities, local ESC/POS TCP delivery and Backend-verified offline proofs. Backend exposes an authenticated branch-scoped capability contract. Mobile checkout defaults off, can be enabled only through `OFFLINE_FIRST_MOBILE_BRANCHES`, and is overridden by `OFFLINE_FIRST_MOBILE_DISABLED`.
- **Safety boundary:** Old print-dependent events without the v2 marker remain blocked. Missing/stale capability, sale policy, product price, table policy, device registration or required printer ownership rejects the operation before durable success. Confirmed `not_sent` print work may retry; unknown delivery never automatically reprints. Production deployment and branch enablement remain separate approvals after physical Android/iOS/printer acceptance.
- **Alternatives rejected:** Enabling every branch in one release; trusting `navigator.onLine`; treating an empty printer cache as no printer; sending the financial event before durable print ownership; auto-reprinting after process death; claiming simulator/unit tests certify real paper or WebView process-kill behavior.
- **Reason:** These boundaries preserve current shops, make rollout reversible, and keep money, stock and kitchen paper idempotent across reconnects without turning a mobile device into the desktop Agent.
- **Approved by:** repo owner (2026-09-09, in-conversation).

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
