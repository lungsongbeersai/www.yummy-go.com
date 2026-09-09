# Android / iOS offline acceptance

Status: mobile checkout implementation is behind a branch allowlist and defaults off. **Do not enable a production branch until the physical Android/iOS acceptance below passes with that branch's printers.**

## Current implementation

- Android and iOS Capacitor apps use Dexie for local reads and staged order edits. No local Agent configuration, login cache, health request, or mirror write is sent by this transport.
- Printer identity resolution bypasses the five-second localhost Agent probe on mobile, retaining the existing browser-device id. The cashier sync badge reads Dexie on mobile instead of polling Agent status.
- Confirmed-offline supported reads/edits do not first wait for the Backend timeout. On reconnect bill operations stay locally owned until the branch queue is empty, including blocked work. Category/product-detail/size reads may load online immediately; their scoped cache writes complete before the immediate add flow uses them.
- Backend registration must succeed before the worker pushes. Store, branch and cashier remain fixed for a worker cycle; a logout/switch stops further sends while an in-flight acknowledgement can still update its original record.
- Native foreground wake triggers a Backend reachability probe and reconciliation. This does not promise background sync while the OS has suspended the app.
- Retry uses the frozen request and original event id. An earlier failure holds later operations; no priority-ordered batch can send payment before creation.
- Late online cache writes cannot overwrite pending local work. A fresh acknowledged server cart carries a replay watermark so quantities are not added twice.
- Native menu cache refresh does not prune the branch's recovery cache while events are pending or blocked. The normal cache cap resumes after acknowledgement; device storage limits still apply.
- Dexie schema v2 adds only a branch-scoped `printQueue`; existing API cache, order outbox and status rows are retained. No PostgreSQL migration, data wipe, new dependency or native installer is included.
- Cached cart rows now retain the actual Backend `title`/`detail.unit_price` snapshot per order item, even without product-detail ids. Tax/service aliases and topping quantities are read from that same response. Missing names/prices stop projection and new staging instead of becoming blank/free items.
- The service worker warms login/tables/order HTML during install and retries route warming on foreground/reconnect. Its error fallback may reopen a cached staff shell despite Next's RSC Vary headers. This is cache recovery, not an embedded native offline bundle or physical-device cold-start certification.
- While Backend is online, native background preparation reads all categories/sorts and full product option/topping responses with two concurrent requests. It verifies saved responses, reuses fresh data for five minutes and retries partial preparation. Fresh menu records do not evict each other at the general 300-response cap. A new device must finish online preparation before those data can exist offline.
- Remote cart images share direct URLs with menu cards. Product images are warmed into their shared cache; opaque CDN responses are accepted and Vary headers do not prevent a cache hit. An image URL in Dexie is not proof that its image bytes are cached or decodable; device storage/expiration still applies.
- New local creates retain item/option/topping display and prices as local event metadata. Existing resolvable legacy drafts are pinned before automatic menu refresh; neither Backend payloads nor sync statuses change.
- Online preparation also caches the branch and table inputs used by Backend VAT/service-charge calculation. A brand-new offline bill fails closed if either policy is missing; an existing bill keeps its original sale snapshot. Exempt/included/excluded VAT and LAK rounding use the shared Frontend rules, while Backend remains authoritative during replay.
- A native branch/device-owned TCP printer plan is committed in the same Dexie transaction as kitchen/payment work. Kitchen/category/zone routing and receipt roles fail closed if a required remote/shared printer cannot be owned by the mobile device.
- The mobile renderer rasterizes Lao/English text and emits bounded ESC/POS bands, drawer pulse and cut through the single shared Capacitor TCP transport. `not_sent` jobs retry with bounded exponential backoff; interrupted or ambiguous delivery becomes `UNCERTAIN` and is never printed again automatically.
- Kitchen events remain staged until every required ticket is `PRINTED`, then freeze `offline_kitchen_proof` with stable stock and print UUIDs. Payment persists its event and durable receipt ownership before returning success, then freezes `offline_print_proof`. Old entries without the v2 contract remain blocked for review.
- Backend `GET /sync/runtime-capabilities` is authenticated and branch-scoped. Mobile checkout/print queue are enabled only for `OFFLINE_FIRST_MOBILE_BRANCHES`; no setting or an emergency `OFFLINE_FIRST_MOBILE_DISABLED` value fails closed. The cached contract expires after 24 hours.

## Remaining release gates

1. **Offline shell restart:** `capacitor.config.ts` still uses the production HTTPS origin. The service worker warms the real login/tables/order documents, but Android and iOS must prove force-close + restart after one prepared online session with WAN unavailable. First-ever install/login without prior online data is intentionally unsupported.
2. **Financial parity:** exercise exempt/included/excluded VAT, per-table service charge, discounts, toppings, sets/promotions, stock-cut rules, credit and mixed tender against Backend totals. A server-side setting changed while the device is offline may correctly block replay rather than silently alter an agreed bill; that recovery path must be observed.
3. **Physical print delivery:** test the exact 58/80mm printer models used by the pilot branch for paper out, socket loss, long Lao tickets, multiple kitchen mappings, cash drawer and process kill during send. Simulator and mocked TCP tests do not certify paper delivery.
4. **Recovery review:** prove the manager can identify and resolve a mobile `UNCERTAIN` ticket without automatic duplication. Historical pre-v2 kitchen/payment entries remain blocked and must not be silently replayed or deleted.
5. **Session cold start:** verify persisted login/remember-me behavior on both OSes; a new password login still needs Backend. Do not store plain-text passwords or invent a local authenticated session.
6. **Controlled rollout:** enable one test branch only, keep the global kill switch ready, observe a full offline/reconnect shift, then expand the allowlist branch by branch. Never use `*` for the first production rollout.

## Acceptance on physical Android and iOS devices

Use a test branch and test printers, not production takings. Keep the router/LAN running while disconnecting WAN.

| Scenario | Required result |
| --- | --- |
| View cached menu/cart; disconnect WAN while native navigator still says online | Probe confirms offline; subsequent supported requests read Dexie without Backend/Agent timeouts |
| Finish online menu preparation without tapping each product; disable WAN; choose another category and an option product | Full size/topping choices and selection limits match the saved Backend response; selected normal option and toppings keep their names/prices in the cart |
| Scroll prepared menu, add to cart offline, then reopen the cart | The same product image loads from the direct image cache, not an uncached optimizer URL |
| Disconnect or exhaust storage during menu preparation | Preparation remains incomplete; already saved records and pending bills remain; no false offline/readiness notification |
| Refresh menu prices while a normal option order is pending | Existing line prices/toppings stay pinned; a newly added line uses the refreshed catalog |
| Add order, change quantity/note, kill and reopen | Same order/item/event ids and amounts survive; no lost edits |
| Reconnect during an order edit | Cart remains local until acknowledgements; late online response does not erase it |
| Reconnect with pending/blocked bills, select an uncached category/product, immediately add | Menu/options load online; the new local item has its name/price; earlier events and cached bill lines remain intact; no Agent request or false offline notice |
| Drop the push response after Backend commit | Retry sends the identical event and payload; one server mutation |
| Fail an earlier event | No later payment/edit overtakes it; record stays inspectable |
| Switch cashier/store/branch | No events are replayed as the new cashier or copied across branches |
| Refresh cart after successful quantity sync, then go offline again | Quantity stays unchanged, not incremented a second time |
| Storage full/unavailable | No success confirmation for an unsaved order |
| Offline kitchen/payment with branch flag disabled or stale | Clear not-ready error before staging; existing order retained |
| Enabled branch: paper out, socket loss, crash after send | Not-sent work remains retryable; uncertain delivery remains retained; no automatic duplicate paper |
| Enabled branch: exempt/included/excluded VAT, service, discounts, toppings/sets/promotions | Local receipt, payment and server totals match exactly or replay blocks visibly before applying a different total |
| Enable the global kill switch during a pilot | New offline kitchen/payment stops before staging; existing durable work remains inspectable |

Automated unit tests use in-memory storage and mocked transports. They are not evidence of real IndexedDB persistence across a WebView process kill, native cold-start behavior, physical print delivery, or end-to-end checkout parity.
