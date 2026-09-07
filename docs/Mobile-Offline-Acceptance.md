# Android / iOS offline acceptance

Status: transport and durability hardening only. **Do not release as complete offline checkout.**

## Current implementation

- Android and iOS Capacitor apps use Dexie for local reads and staged order edits. No local Agent configuration, login cache, health request, or mirror write is sent by this transport.
- Printer identity resolution bypasses the five-second localhost Agent probe on mobile, retaining the existing browser-device id. The cashier sync badge reads Dexie on mobile instead of polling Agent status.
- Confirmed-offline supported reads/edits do not first wait for the Backend timeout. On reconnect the branch stays locally owned until its queue is empty, including blocked work.
- Backend registration must succeed before the worker pushes. Store, branch and cashier remain fixed for a worker cycle; a logout/switch stops further sends while an in-flight acknowledgement can still update its original record.
- Native foreground wake triggers a Backend reachability probe and reconciliation. This does not promise background sync while the OS has suspended the app.
- Retry uses the frozen request and original event id. An earlier failure holds later operations; no priority-ordered batch can send payment before creation.
- Late online cache writes cannot overwrite pending local work. A fresh acknowledged server cart carries a replay watermark so quantities are not added twice.
- No schema version bump, SQL table, database wipe, dependency installation or native installer is included.

## Required implementation before mobile checkout release

1. **Offline application shell:** `capacitor.config.ts` still loads a remote server URL. `capacitor-web/index.html` is an internet-required placeholder, not the POS. Bundle/cache the real application and verify Android/iOS force-close + restart with WAN unavailable. A cached API response in Dexie alone does not load the app shell.
2. **Sale-time snapshots and bootstrap:** cache the complete branch/table tax and service policy, product options, promotion/set pricing, stock policy, printer roles/category/zone mappings and toppings. The existing staff payload supplies zero rates and relies on Backend enrichment online; the mobile reducer cannot treat those defaults as authoritative tax policy. Missing master data must not silently create zero-priced sales. Avoid relying solely on pages the user happened to visit.
3. **Native printing:** create branch-scoped durable print jobs and a local ESC/POS renderer. Existing Capacitor TCP delivery accepts rendered bytes, but `renderMobileEscpos` still calls Backend and synthesized offline order responses contain no print jobs. Reuse the existing templates/routing rules and persist confirmed/failed/uncertain delivery separately. Do not automatically reprint unknown delivery after a crash.
4. **Kitchen/payment evidence:** generate the real `offline_kitchen_proof` / `offline_print_proof` and stable stock ids accepted by Backend. Persist bill, payment and jobs atomically before showing completion. Only then remove the safety guards in `write-fallback.ts` and `pushBrowserSyncQueueNow`.
5. **Recovery review:** expose safe inspection/resolution of historical mobile kitchen/payment entries. They now remain blocked for review, not silently replayed or deleted. Desktop Agent repair endpoints are not a mobile review implementation.
6. **Session cold start:** verify persisted login/remember-me behavior; new password login on mobile still needs Backend. Do not store plain-text passwords or invent a local authenticated session.

## Acceptance on physical Android and iOS devices

Use a test branch and test printers, not production takings. Keep the router/LAN running while disconnecting WAN.

| Scenario | Required result |
| --- | --- |
| View cached menu/cart; disconnect WAN while native navigator still says online | Probe confirms offline; subsequent supported requests read Dexie without Backend/Agent timeouts |
| Add order, change quantity/note, kill and reopen | Same order/item/event ids and amounts survive; no lost edits |
| Reconnect during an order edit | Cart remains local until acknowledgements; late online response does not erase it |
| Drop the push response after Backend commit | Retry sends the identical event and payload; one server mutation |
| Fail an earlier event | No later payment/edit overtakes it; record stays inspectable |
| Switch cashier/store/branch | No events are replayed as the new cashier or copied across branches |
| Refresh cart after successful quantity sync, then go offline again | Quantity stays unchanged, not incremented a second time |
| Storage full/unavailable | No success confirmation for an unsaved order |
| Current offline kitchen/payment buttons | Clear not-ready error before staging; existing order retained |
| Future native printer queue: paper out, socket loss, crash after send | Failed/uncertain delivery retained; no automatic duplicate paper |
| Future checkout: exempt/included/excluded VAT, service, discounts, toppings/sets/promotions | Local receipt, payment and server totals match exactly |

Automated unit tests use in-memory storage and mocked transports. They are not evidence of real IndexedDB persistence across a WebView process kill, native cold-start behavior, physical print delivery, or end-to-end checkout parity.
