# POSAll online 3D simulator

This document records the code audit, the implementation boundary, and the verification evidence for the simulator. A production feature appearing in the inventory does not by itself mean that the simulator supports it. The matrix below distinguishes those claims.

## Live restaurant view

The window now opens in **Live restaurant** mode. Actual customer orders, table states and open bills appear through an authenticated, read-only endpoint. Staff can select tables or bills to inspect real item names, quantities, statuses and stored bill totals. The **Training** switch opens the isolated simulator. Existing URLs with `session_uuid` still restore training; `?mode=training` and `?mode=live` select a mode explicitly. Switching away from an active, connected training session pauses it first; an unresolved command must be reconciled before switching modes.

`GET /api/v1/simulator/live?branch_uuid=…&lang=…` rechecks current employee, role, store, branch and assigned zones for every request. Zone-restricted staff see orders on their assigned tables and their own counter bills. It performs three authorization SELECTs and one bounded SQL statement for a consistent tables/orders/items snapshot. There are no production or simulation writes, print jobs, payment calls or notifications. Customer names, telephone numbers, notes, tender details and account details are omitted. Headcount is `null` because the POS does not store an actual guest count; seat capacity remains labeled as seats.

Updates run every 10 seconds while the window is visible and focused, with immediate refresh on focus, online recovery and the refresh button. Requests never overlap, are cancelled on blur, branch/language switch and unmount, and late responses are rejected after a scope change or logout. A connection failure clearly marks the last successful snapshot as stale; permission denial clears it. No transaction data is persisted in the browser. Current changes are observed on the next successful fetch; this mode does not promise instantaneous delivery.

The API returns at most 400 tables, 400 open orders and 4,000 item rows and flags truncation. To limit mobile WebGL/HTML overhead, the scene renders at most 80 tables and always includes a selected table. Zone/status filters apply to the table list; representative customer markers are limited to tables present in the scene. The complete returned table list remains available, and a visible notice explains scene limits. People and room layout are illustrations, not physical tracking. Persisted item statuses retain their actual codes: 0 customer draft, 1 awaiting confirmation, 2 sent to kitchen, 3 preparing, 4 served, 9 cancelled. Stored bill totals are displayed without recalculating or updating production bills.

The restaurant scene uses scoped light/dark material tokens for warm timber, upholstered zone seating, plants, stainless kitchen furniture and a teal cashier. Six table states have distinct colors plus text: available green, occupied blue, staff draft orange, customer confirmation amber, staff call red and bill request pink. These tokens do not change the main POS theme. Furniture is instanced, actors are bounded, rendering uses adaptive DPR and demand frames, and inactive windows stop rendering.

Language changes retain the authorized snapshot and scene while replacing the in-flight read. Preference synchronization uses the stable simulator i18n instance: react-i18next 17 changes its hook-returned wrapper identity when the language changes. Projected DOM labels use a small local `scene-label.tsx` helper with a fresh container per effect and deferred React-root disposal; this avoids the synchronous nested-root cleanup race observed in the pinned Drei Html component under React 19 StrictMode. StrictMode remains enabled.

Added files: `live-workspace.tsx`, `live-i18n.ts`, `live-helpers.ts`, `scene-label.tsx` and tests under `src/features/simulator/`; `src/stores/simulator-live-store.ts` and tests; backend `api/v1/simulator/live.js`, `live.test.js`, `live-fixtures.js`. The existing simulator service/types, router, mode workspace, scene, translations and browser runner are extended. No new dependency, database column, table or migration is required for live mode.

## Live enhancement verification — 2026-10-29

All checks used the installed Node 22.22.3 runtime. Backend tests use synthetic PostgreSQL connection settings and disposable fixtures; browser tests never import production database configuration.

| Check | Observed result |
| --- | --- |
| Frontend `npm run typecheck` | Passed. |
| Frontend `npm run lint` | Zero errors; the same three existing warnings. |
| Frontend `npm test` | **2,599/2,599 passed**, 231 files. |
| Backend full suite, concurrency 2, timeout 120 seconds | **1,556/1,556 passed**; no skipped tests. |
| Backend live/catalog/repository suites | **34/34 passed**, including real authorization, assigned zones, revocation, counter ownership, privacy and SELECT-only snapshots. |
| Frontend `npm run build` | Passed with webpack, including `/simulator` and TypeScript validation. |
| Chrome full `npm run test:simulator:e2e` | **22/22 scenarios passed**, 39 isolated command requests, zero uncaught page errors and zero external HTTP requests. |
| Chrome focused live view | **7/7 passed**. Run with `SIMULATOR_E2E_LIVE_ONLY=1` to omit the older training scenarios. |
| `git diff --check` | Passed in both repositories. |

The browser scenarios cover actual order arrival and quantity/status changes without UI commands, actual bill closure/table release, stale state and reconnect, mobile/desktop layouts, Thai language switching, inactive-window polling/render suspension and training/live transitions. The full run also repeats training payments, printing simulations, deposits, QR ordering, automatic service, popup authentication, server recovery and SQL/HTTP isolation. Artifacts are under workspace `.work/simulator-live/`: `results.json`, `live-mobile.png`, `live-desktop.png`, `live-desktop-thai.png` and the training screenshots. These are local fixture observations; production latency and physical-device FPS have not been measured.

## Audited architecture

The workspace contains separate Git repositories: `New-Yummy-go.com` (Next.js 16, React 19, TypeScript, Zustand, Axios), `back-end` (Express/Node.js, PostgreSQL, Socket.IO), and `printer-agent`. The simulator belongs to the existing frontend and backend. It must not call production transaction mutation endpoints, build real printer jobs, send notifications, deduct production stock, or write production reports.

Frontend data flow stays `route → feature → Zustand store → service → apiRequest`. Authentication remains the existing client token/AuthGuard flow; authorization and persistent business validation happen in Express. No business logic or database is added to the Next server. Simulation state must not be persisted in browser storage, queued offline, or represented as successful merely because an animation completed.

Production evidence:

| Concern | Actual source |
| --- | --- |
| Authenticated Axios transport and backend envelope handling | `src/lib/api.ts` |
| Auth persistence/session validation | `src/stores/auth-store.ts`, `src/components/layout/auth-guard.tsx` |
| POS API models and transport | `src/services/pos/types.ts`, `src/services/pos/requests.ts`, `src/services/pos/order-queue-requests.ts` |
| POS state/actions | `src/stores/pos-store.ts`, `src/stores/pos-store/` |
| POS table/order UI and reusable display logic | `src/features/pos/table-selection/`, `src/features/pos/order-customer/`, `src/features/pos/order-queue/` |
| Staff JWT and live account/store revocation | `../back-end/config/jwt.js`, `../back-end/utils/authSession.js` |
| POS branch, zone, order access, and kitchen action permissions | `../back-end/api/v1/posAll/create.js` (`getCreateOrderLoginScope`, `assertLoginCanAccessTable`, `assertLoginCanAccessOrder`, `assertKitchenConfirmPermission`) |
| Management branch/store scope | `../back-end/api/v1/shared/branch-management-scope.js` |
| Production POS workflows | `../back-end/api/v1/posAll/create.js` |
| Money/VAT/calculation engines | `../back-end/api/v1/shared/lak-money.js`, `vat-calculation.js`, `order-recalculation.js` |
| Authoritative table status derivation and QR revocation | `../back-end/api/v1/table/table-status.js` |
| Kitchen routing and print role decisions | `../back-end/api/v1/posAll/posall-printer-routing.js`, `../back-end/api/v1/printer/print-role-permissions.js` |
| Category visibility | `../back-end/api/v1/shared/category-visibility.js`, `../back-end/api/v1/posAll/category-visibility.js` |
| SET options, choice validation, and quantity allocation | `../back-end/api/v1/shared/set-child-options.js`, `../back-end/api/v1/posAll/set-choice-order-validation.js`, `split-bill-quantity.js` |
| Customer product deposits/redemptions | `src/services/deposit.ts`, `../back-end/api/v1/deposit/create.js` |
| Waiter requests | `src/services/waiter-requests.ts`, `../back-end/api/v1/posAll/waiter-requests.js` |

## Existing POSAll feature inventory

API paths in this inventory are production evidence, **not simulator write destinations**. Unless stated otherwise, these routes are registered in `../back-end/api/v1/posAll/create.js` under `/api/v1`.

| Existing feature | API/source evidence | Business rule and simulator consequence |
| --- | --- | --- |
| Branch zones/tables and tableless stores | `GET /posAll/fetch_table`; `getCreateOrderLoginScope` | Tables are scoped to the authenticated branch and assigned `tb_login_zone` rows. Empty assignments mean all zones in that branch. `tb_stores.store_table_status`: 1 with tables, 2 without tables. Training copies configuration into isolated state; Live restaurant reads actual occupancy/orders without changing them. |
| Manual table states and customer alerts | `POST /posAll/table_status`; `api/v1/table/table-status.js` | Available 1, active 2, cashier creating 3, awaiting customer confirmation 4, call staff 5, request check bill 6. Preserve alert states during normal derivation. Do not use the legacy numeric semantics in `posAll/table-status.js`. |
| Menu categories, product search, product classes | `GET /posAll/fetch_cate_products`; `POST /posAll/get_prod_item` | Product classes are normal 1, SET 2, promotion 3. Prices/details belong to the selected branch. Category visibility is role/store policy, including anonymous QR restrictions. |
| Product sizes/details, notes, toppings, tastes | `POST /posAll/get_prod_item`; `normalizeOrderItemsForCreate`; `src/features/pos/order-customer/{topping-selection,taste-selection,order-selection-validation}.ts` | Validate configured active choices, selection limits, duplicate choices, detail ownership, and server prices. Do not accept client-supplied prices. |
| SET menus | `normalizeOrderItemsForCreate`, `validateSetChoiceSelectionsForCreate`; `set-choice-order-validation.js`; `set-child-options.js` | Choice groups may share details; child options/sauces/tastes have separate groups and limits. Persist a SET instance UUID and quantity. Confirm/cancel/serve operations expand only that persisted instance, never another identical SET. Partial simulation support must be called out explicitly. |
| Timed and buy/free promotions | `api/v1/shared/promotion-time.js`; `normalizeOrderItemsForCreate`; frontend `pricing.ts`, `product-availability.ts` | Promotion date/time uses the configured business timezone. Quantities can include free components and stock factors. Ordinary detail pricing is not full promotion parity. |
| Create and append orders | `POST /posAll/create_order` | Staff table items start at 1; customer QR drafts at 0; tableless staff items start at 2. Server owns status, stock events, and prices. Additional orders reuse the open bill. |
| Counter/tableless bill reuse | `POST /posAll/init_order_without_table`; `no-table-order-reuse.test.js` | Reuses the cashier's eligible open bill; no fabricated table is required. Tableless orders have no table service charge. |
| Cart/bill history and pending totals | `GET /posAll/fetch_cart`; `cart-pending-total.test.js`; frontend `cartOrdersToHistory` | Active visibility includes status 0; billable/recalculated item statuses are 1–4. Pending draft totals and committed totals differ. |
| Quantity increase/decrease | `PATCH /posAll/order_item/update_qty` | Customer edits only status 0. Staff with tables edit only status 1; staff without tables edit status 1 or 2. SET/promotional quantity and stock effects require their associated rules. |
| Item and bill discounts | `PATCH /posAll/item_discount`, `PATCH /posAll/bill_discount`; `order-recalculation.js` | Both amount and percentage types exist. Clamp discounts to applicable gross/subtotal, calculate service after discounts, then VAT using shared rounding. |
| Note changes | `PATCH /posAll/update_note`, `PATCH /posAll/customer/update_note` | Apply existing ownership/status restrictions; editing a UI field alone is not persistence. |
| Delete uncommitted items | `DELETE /posAll/delete_order_item` | Distinct from cancellation of committed kitchen items; enforce active order and editable item rules. |
| Cleanup drafts | `PATCH /posAll/order_item/cleanup_draft` | Deletes only the caller's unconfirmed staff items, preserves other staff items and confirmed items, frees the table only when eligible. |
| Confirm to kitchen | `PATCH /posAll/confirm_to_kitchen`, `PATCH /posAll/confirm_to_kitchen_batch` | Kitchen confirmation is an action permission granted by POS/table-sale or order-management menu permissions. Custom waiter roles can have permission; role numbers alone are insufficient. |
| Kitchen queue/batch sending | `GET /posAll/customer_order_queue`, `PATCH /posAll/customer_order_queue/send_to_kitchen` | Supports tables and tableless orders, item/order/table filtering and grouped SET tickets. Do not conflate kitchen job progress with production item status. |
| Print-on-confirm routing and permissions | `printer/create.js` (`getPosAllPrinterConfigs`, `resolveKitchenPrinterTargets`); `printer/printer-mapping-policy.js`; `printer/print-role-permissions.js`; `posall-print-permission-state.js` | CATEGORY routes match category; ZONE routes require the exact category/zone pair. Both mapping types can coexist, including for one category. The live resolver sorts ZONE first but does not globally suppress CATEGORY routes; `choosePosAllPrinterMappingType` has no production caller. Printer eligibility also includes dedicated/shared ownership and endpoint deduplication. Printing permissions can differ per category/role. Saved decisions govern later cancellation/reprint destinations. Items without applicable printers may confirm immediately. A simulator may read decisions using a non-persisting path but must never create real print jobs. |
| Reprint kitchen tickets | `POST /posAll/reconfirm_to_kitchen` | Document-only retry/reprint; must not deduct stock or confirm items a second time. |
| Serve items/batches | `PATCH /posAll/confirm_order_item_served` | POSAll changes status **2 → 4**. Status 3 is explicitly not part of the normal POSAll serve flow. Expand grouped items/SET instances. |
| Cancel committed or pending items | `PATCH /posAll/cancel_order_item`; `split-bill-quantity.js` | Allowed source statuses 0,1,2,3; status 4 served items cannot be cancelled. Partial quantity cancellation exists. Sent items create cancellation ticket snapshots and may reverse stock; simulator effects must stay isolated. |
| Move tables | `GET /posAll/fetch_join_move_table`, `POST /posAll/move_table` | Different source/target; target status 1 and no open target bill. Tables/branch ownership must be validated. Source QR is revoked/rotated. Locks serialize conflicting operations. |
| Merge multiple tables | `POST /posAll/join_table_multi` | Destination must be active status 2 with an open bill. Exclude destination from sources, same-branch ownership, deterministic locking; close source bills, recalculate target, revoke source QR. |
| Split bill by item/quantity | `POST /posAll/split_bill`; `split-bill-quantity.js` | Positive integer quantities within available group quantities; active statuses 1–4. SET/group identity and proportional allocations must survive split. Split may create a bill and optionally process its payment. |
| VAT and table service | `getEffectiveChargeVatForOrder`, `getEffectiveChargeVatWithoutTable`; shared `vat-calculation.js` | VAT 1 exempt, 2 included, 3 excluded; use `resolveBranchVatStatus` for legacy branch compatibility. Service enabled only when branch AND table charge status are 1; tableless service is 0. Snapshot rates on orders. |
| LAK rounding | `shared/lak-money.js`; `shared/order-recalculation.js` | Rounding version 1 integer legacy values; version 2 nearest 1,000 LAK. Totals depend on configured version. Reuse shared engine rather than recompute client totals. |
| Payment currencies/exchange snapshots | `posAll/payment-currency.js`; payment route | LAK, THB, USD. Validate configured exchange rate and persist settlement snapshot. Decimal conversion uses integer arithmetic to avoid floating-point errors. |
| Cash/transfer/combined/credit | `POST /posAll/payment`; `normalizePaymentInput`, `validatePaymentRequestInput` | Method 1 cash, 2 bank transfer/QR, 3 combined cash+transfer, 4 credit. Credit requires customer/due date, zero cash/transfer/change. Transfer account comes from authenticated branch. |
| Partial and repeated payments | `POST /posAll/payment`; `payment-replay.js` | Track paid total and balance; payment UUID identity + advisory/order locks prevent double charging/replay mismatch. Close bill only when fully paid; another split bill can keep the table occupied. |
| Invoice/receipt/reprint | `POST /posAll/print_invoice`, `POST /posAll/reprint_receipt` | Production calls can create real jobs. Simulation needs separate receipts clearly marked simulation and must not invoke printer-agent/native TCP. |
| Table QR/seating visit | `GET /posAll/admin/create_table_qr`; `revokeTableQrAfterBillClose` | QR is seating/version-bound, revoked on final bill close or move; a stale guest token must not open a new bill after payment. Simulated codes must never be valid production QR tokens. |
| Branch menu QR | `GET /posAll/branch_menu_qr/create`; customer menu routes | Branch-only browse token, no table/order writes. Requires a separate safe simulation representation if exposed. |
| Customer QR ordering | `/posAll/customer/{qrscan,fetch_cate_products,get_prod_item,fetch_cart,create_order,order_item/update_qty,delete_order_item,confirm_to_kitchen}` | Public token authentication differs from staff JWT. No production QR writes may be reused by the simulator. |
| Customer service requests | `posAll/waiter-requests.js`; `/posAll/customer/waiter_requests`, `/posAll/waiter_requests`, `/posAll/waiter_requests/:id` | Requests are seating-version scoped, rate limited and idempotent, with staff zone access. Kinds are bowl/spoon/chopsticks/staff and a bounded message. |
| Customer management | `api/v1/customer/api_customer.js`; `src/services/customer.ts` | List/create/delete and store-scoped uniqueness exist. Simulator customer records must be separate; no real notifications. |
| Product deposits and withdrawals | `/posAll/deposit/{create,withdraw,list,detail,order-redemptions}` in `api/v1/deposit/create.js` | These are **product quantities**, with expiry, remaining quantity, idempotent withdrawals, customer/order linkage and zero-charge redemption. They are not cashier cash deposits/withdrawals. |
| Credit settlement/history | `api/v1/credit/create.js`; `src/services/credit.ts` | Separate credit permission/scope and payment/report rules. Do not claim supported from cash payment alone. |
| Order cancellation/report adjustment | `src/services/cancel.ts`; `api/v1/display/` | Separate management cancellation/report pathways exist. Item cancellation before serving is not a financial refund/reversal. No generic POSAll refund endpoint was found in the audited POSAll router. |
| Stock behavior | `decreaseStockIfNeeded`, `increaseStockIfNeeded`, `recordStockMovement` in POSAll; stock management service | Stock event identity prevents repeated deductions; SET/promotions change factors. Simulation inventory must use copied quantities and private effects only. |
| Reports/audit | `src/services/report/`, `api/v1/report_all/`, `shared/order-audit-context.js` | Production reports read real payment/order data. Simulator totals/history must derive solely from its own sessions and payments. |
| Guest count/seating | No guest-count mutation contract found in audited POSAll services/router | May be implemented as isolated simulation metadata; do not invent a production database column/API. |

## Authorization findings

`config/jwt.js` verifies an RS256 token from `x-access-token` and re-reads `findSession()` before supplying `req.uuid`, `req.branch_uuid`, `req.store_uuid_fk`, `req.login_status`, and `req.store_status`. A URL branch UUID never establishes access.

Production operational POS handlers use the employee's current database branch, validate active login/store, and enforce assigned zones. Management branch access is a different contract: branch managers (role 3) are restricted to their branch; roles 1/2 can manage other stores only when the authenticated store is a PLC store (`store_status = 1`). Branch option lists must not silently become permission to mutate another branch's production transactions. A simulator can offer only explicitly verified authorized configuration scopes and must retain its own owner/store/branch/session isolation.

Kitchen confirmation checks active `tb_role_permission`/`tb_sub_menu` grants for `/sales/open-table-sale` or `/order_manage`, with the existing super-admin exception. Category visibility and category printer permissions are independent additional policies.

## Simulator feature matrix

“Implemented” describes the runtime operation and its automated checks, not a claim of completed authenticated browser/device acceptance. The explicit limitations remain part of the delivery scope.

| Capability | Simulator status | Evidence/limitation |
| --- | --- | --- |
| Separate authenticated window and lazy 3D route | Implemented | POS launcher opens `/simulator?branch_uuid=…`; existing AuthGuard and same-origin token/session storage; 3D is dynamically imported only by the simulator page. Chrome E2E verified the real POS launcher, non-remembered session inheritance and independent popup closure; physical-device acceptance remains pending. |
| Online-only server-authoritative sessions | Implemented | PostgreSQL JSONB sessions and operation log; no browser transaction persistence/queue; interrupted operation identity retained only in memory for authenticated online reconciliation. |
| Branch/store/zone/session isolation | Implemented | Live employee/store/role validation, role-granted branch list and assigned-zone table filtering; every session read/write is owner-scoped and reauthorized. Changing a URL does not confer access. |
| Table open/guests/customer seating | Implemented | Copies authorized tables/zones and capacity, creates private bills, updates guests/customer assignment and 3D state. Guests are simulation metadata. |
| Menu/search/normal products/options/notes/quantity | Implemented | Server-owned branch prices, distinct topping limits, active flavor selection validation, stock factors and appropriate editable statuses. |
| Timed and buy/free promotions | Implemented | Reuses `shared/promotion-time.js`; bought and free quantities are recorded separately, charged quantity excludes free units, simulated stock includes both. |
| SET menus and advanced child groups | Unsupported | Catalog rows explicitly expose `supported: false` and a reason. Fixed and selectable SETs require full component/group/sauce/stock-instance parity; there is no placeholder success. |
| Kitchen confirm, batch selection, prepare, ready, serve | Implemented | Private job queue; staff confirmation 1 → 2 and serving 2 → 4. Preparing/ready are distinct simulation kitchen phases. |
| Printer mapping/role policy/failure/retry | Implemented with limits | Reads active actor-owned dedicated/shared category/zone mappings and per-category role policy. Simulates paper success/failure/retry; no agent URL, physical printer, production queue or native transport call. Physical device transport/presence are outside simulation scope. |
| Move and merge | Implemented | Rejects occupied transfer target and invalid merge destination, updates private orders/characters/kitchen labels and revokes source seating visits. |
| Split bill | Implemented for supported products | Select whole lines or a positive integer quantity from each eligible line (statuses 1–4). Reuses production quantity planning/proportional allocation for promotion freebies, amount discounts and stock attribution. Split bills retain the physical table and service snapshot; the table stays occupied until all bills settle, and an emptied source bill closes. SET/grouped component splits remain unsupported. |
| Discounts/VAT/service/rounding | Implemented | Shared backend totals/VAT/LAK engines, configured table service and snapshots; authoritative totals come from server state. |
| Cash/transfer/QR, configured currencies and partial payments | Implemented | Active branch account presence enables transfer/QR; configured LAK/THB/USD rates; cash change, balance, operation idempotency, closure, receipt and table release. This records simulated tender only. |
| Combined single-tender payment and credit settlement | Unsupported | Separate partial cash/transfer payments work; production method-3 combined payloads, method-4 due-date credit ledger and credit collection/reporting are not reproduced. |
| Simulated customer profiles, history, sales and activity | Implemented with limits | Session-private profiles support create/update and normalized member-code uniqueness; guest names and paid-bill history/sales/activity are stored privately. No production customer edits or notifications; profile deletion and management reports are not reproduced. |
| Product deposits, withdrawals and zero-charge redemptions | Implemented | Isolated quantity ledger, three-decimal quantities, actual `deposit_expire_days` store setting, Vientiane calendar expiry, linked purchased-quantity caps, nonnegative balance, full-withdrawal state and receipt annotations. Deposits never create revenue or deduct stock again. |
| Simulation table QR and visit codes | Implemented with limits | Opaque `simvisit_` token and `SIM-` code, current seating/version/session scope, expiry, scan counters, guest draft 0 → submission 1 → staff confirmation 2, editable own unsubmitted drafts, automatic final-bill/transfer/merge revocation and restore invalidation. Paying one of several same-table split bills retains the seating token and rebinds its cart to a remaining bill. Both production QR codecs reject these tokens. This is an authenticated in-simulator guest workflow, not a public QR ordering page. |
| Branch browse-only QR/public external customer route | Unsupported | No production-signed tokens, production `/q/` link or unauthenticated simulator endpoint is generated. A physical phone scanning the encoded opaque value does not open a public ordering website. |
| Draft cleanup, cancellation and stock effects | Implemented for supported products | Own unconfirmed staff draft cleanup, served-item cancellation prohibition, whole or positive integer partial-quantity cancellation, proportional free-unit allocation and exact isolated stock rollback. Production SET component cancellation and separate cancellation-ticket printing remain unsupported. |
| Refunds/reversals | Unsupported | Item cancellation does not imply financial refunds; no fake financial reversal endpoint/button is exposed. |
| Manual/autonomous shared validated engine | Implemented | Both use the same domain actions, persisted through authenticated online commands; client-generated auto ticks stop on connection failure, hidden window and paused mode. No background local transactions occur. |
| Start/pause/resume/reset/save/restore | Implemented | Online persistent actions, saved server snapshot, paused/manual restoration, operation hash identity and version conflict protection. Reset/restore are confirmed in the interface. |
| Lao/Thai/English and responsive accessibility | Implemented; device QA pending | Feature-local i18next resources and existing UI primitives/design tokens; Lao/English catalog names follow available database fields, with no invented Thai database names. |

## Required verification

Run frontend `npm run typecheck`, `npm test`, and `npm run build` (keep `--webpack`). Run the backend test command plus new simulator suites. Report commands and their actual results; pure engine tests do not establish browser E2E or physical device performance.

The simulator tests should cover branch/store/owner denial, table conflicts and zone filtering; open/add/quantity/confirm/kitchen/serve/additional-order/cancel; original discount and VAT/rounding parity; move/merge/split; partial and duplicate payments; last-bill table release; reset/save/restore; autonomous progression; paused/lost lease rejection; and request idempotency/version conflicts. Persistence tests should assert that only simulation tables are mutated and no real print, payment, customer notification, stock, or reporting APIs are used.

The automated Chrome runner uses synthetic employee credentials and the real simulator router/repository/domain against a disposable PostgreSQL-compatible database. Connected staging acceptance with real account configuration, multiple backend instances and hardware devices remains separate. The focused SQL authorization and concurrency suites cover branch/zone/owner denial and conflicting writers without contacting production.

Measure actual FPS, memory and API request frequency on Windows/macOS, iPad and supported mobile browsers under representative table/customer counts. A configured low-poly scene or limited pixel ratio is not evidence that the approximately 30 FPS target was achieved. No physical-device performance measurement is recorded by the audit itself.

## Routes, persistence, changed files and test results

Frontend additions:

- `src/app/simulator/page.tsx` — thin route.
- `src/features/simulator/` — simulator workspace, launcher, responsive context/order/payment/deposit/visit controls, confirmation dialogs, local translations and lazy restaurant scene.
- `src/services/simulator/` — typed online contract, transport and transport tests.
- `src/stores/simulator-store.ts` and associated tests — async state, branch/session guards, versioned commands, memory-only interrupted request identity, long polling and authenticated reconciliation.
- `src/features/pos/table-selection/table-selection-page.tsx` — launcher integration.
- `src/features/pos/order-customer/order-customer-view.tsx` — launcher on tableless/order and small browser layouts.
- `scripts/simulator-browser.e2e.mjs` — disposable authenticated browser fixture with real simulator router/repository/domain and PostgreSQL-compatible test storage, external-request blocking and production-write assertions.
- `docs/Decisions.md` — records the simulator boundary and user-requested browser test tooling.
- `package.json`, `package-lock.json` — React Three Fiber and Drei alongside the existing Three.js and Zustand; Playwright for development-only browser tests.

Backend additions:

- `api/v1/simulator/catalog.js` — SELECT-only authenticated configuration/catalog access, visibility, branch/zone scope, currency/accounts and simulated printer routing metadata.
- `api/v1/simulator/domain.js` — validated shared manual/auto operations and calculations.
- `api/v1/simulator/deposits.js` — private customer profiles/product quantity deposits and receipt-only redemptions.
- `api/v1/simulator/visits.js` — opaque simulated table visits, guest drafts, version checks and revocation.
- `api/v1/simulator/repository.js` — PostgreSQL transactions, row locks, owner isolation, versions, operation hashes, save/restore and event waiters.
- `api/v1/simulator/create.js`, `router.js` — existing JWT wiring and injectable authenticated Express endpoints; tests never import the live database configuration.
- Colocated `catalog.test.js`, `domain.test.js`, `deposits.test.js`, `visits.test.js`, `repository.test.js` and fixtures — focused automated evidence.
- `api/v1/url.js` — mounts the simulator router without altering production endpoint contracts.
- `migrations/20261027_simulator_online.sql`, `scripts/apply-simulator-online-migration.js`, backend package migration command.

New authenticated endpoints, all under `/api/v1/simulator`:

| Method/path | Contract |
| --- | --- |
| `GET /bootstrap?branch_uuid=…` | Current authorized actor, branches, branch settings, tables, catalog and permissions. |
| `GET /live?branch_uuid=…&lang=…` | Read-only current authorized table/open-order/item snapshot, fetched timestamp, summary, limits and truncation flag. |
| `GET /sessions?branch_uuid=…` | Up to 40 sessions owned by the authenticated employee for the authorized branch. |
| `POST /sessions` | Create an isolated session from authorized current configuration; body `branch_uuid`, optional `name`. |
| `GET /sessions/:id` | Authoritative session state, after current scope validation. |
| `GET /sessions/:id/events?version=…` | At most 20-second authenticated long poll; resolves on a committed event or timeout and supports abort cleanup. |
| `POST /sessions/:id/actions` | Body `{ operation_uuid, expected_version, type, payload }`; row-lock/version/hash checks precede a validated persistent action. |

Actions cover controls (`start`, `pause`, `resume`, `mode`, `reset`, `save`, `restore`), seating/orders (`open_table`, `guests`, `assign_customer`, `add_item`, `edit_item`, `cancel_item`, `cleanup`, `discount`, `confirm`, `transfer`, `merge`, `split`, `request_bill`, `pay`), kitchen (`kitchen_ready`, `serve`, `printer_fail`, `printer_retry`), autonomous progression (`tick`), customers/deposits (`customer_create`, `customer_update`, `deposit_create`, `deposit_withdraw`) and simulated guest visits (`visit_create`, `visit_revoke`, `visit_scan`, `visit_add_item`, `visit_edit_item`, `visit_delete_item`, `visit_submit`). Unsupported action names return errors.

The additive training migration creates only `public.simulator_sessions` (owner/store/branch scope, JSONB state and saved snapshot, monotonic version and timestamps) and `public.simulator_operations` (session/operation composite key, request hash and applied version). It does not alter production tables or install offline storage. The backend deployment workflow runs `npm run migrate:simulator-online` before restarting the API; the earlier training release already applied this migration. The live restaurant enhancement needs no additional migration, and its tests use disposable databases.

Recorded focused verification:

| Command | Actual observed result |
| --- | --- |
| `node --check api/v1/simulator/catalog.js` | Passed syntax check. |
| `node --test --test-reporter=spec api/v1/simulator/deposits.test.js` | 8/8 passed. |
| `node --test --test-reporter=spec api/v1/simulator/visits.test.js api/v1/simulator/deposits.test.js` | 18/18 passed with domain integration. |
| `node --test --test-reporter=spec api/v1/simulator/visits.test.js` (after same-table split integration) | 13/13 passed, including retained QR/customer ordering while a split bill remains open, final-bill revocation, full split and true transfer/merge revocation. |
| `node --test --test-reporter=spec api/v1/simulator/domain.test.js api/v1/posAll/posall-printer-routing.test.js api/v1/printer/printer-mapping-policy.test.js api/v1/printer/printer-mapping-routes.test.js` | 113/113 passed; the new simulator regression retains CATEGORY plus applicable ZONE destinations, excludes another zone and role-blocked configs, and preserves independent routing for another category. |
| `node --test --test-reporter=spec --test-timeout=30000 api/v1/simulator/catalog.test.js` | 8/8 passed against PGlite after promotion and anonymous-menu integration. Covers SELECT-only configuration reads, scope/zone denial, hidden categories, current rates, printer policy, stock factors and real promotion fields. |

Original training release checks (2026-10-27, Node 22.22.3):

| Check | Actual observed result |
| --- | --- |
| Frontend `npm test` | **2,522/2,522 tests passed**, 228 files. |
| Backend `node --test --test-concurrency=2 --test-timeout=120000` | **1,542/1,542 tests passed** in about 107 seconds after the final zero-settlement and Auto stock-exhaustion fixes. Synthetic PostgreSQL connection settings prevent production access; fixture HTTP listeners use localhost only. |
| Focused backend simulator suites | **75/75 tests passed** after current counter printer policy, quantity split/cancel, multi-bill QR retention, zero-value settlement and sold-out/mixed manual-Auto customer recovery. These are included in the full backend suite. |
| Frontend `npm run typecheck` | Passed on the final source. |
| Frontend `npm run lint` | Passed with zero errors and three pre-existing warnings in `language-switch.tsx`, `use-order-customer-workflow.ts`, and `lib/api.ts`. |
| Deployment fixture `node --test scripts/deploy/deploy-release.test.mjs` | **12/12 passed** against local temporary files/mocked services; no VPS contact. |
| Frontend `npm run build` | Passed using the required webpack build on Node 22; final compile about 38.5 seconds and TypeScript about 8.5 seconds, with `/simulator` generated. |
| Chrome `npm run test:simulator:e2e` | **17/17 scenarios passed**, 38 validated online action requests, zero external HTTP requests and zero uncaught page errors. |
| `git diff --check` | Passed in frontend and backend. Printer Agent working tree remains unchanged. |

The host defaults to unsupported Node 23.10.0 for some test dependencies. An initial concurrent run there hit ten existing 30-second test deadlines and observed a split assertion while that implementation/test was being updated. All final results above were rerun with the installed supported Node 22 runtime after the relevant implementation was finalized; no unrelated production tests were modified.

Physical-device FPS/memory and deployed PostgreSQL/load testing remain separate acceptance work. The scene caps animation at 24 actors (16 customer groups plus staff in the workspace), uses instanced furniture and an adaptive pixel ratio, and stops its render clock when hidden; these are implementation measures rather than measured 30 FPS evidence.



## Original training browser evidence and performance observations

`npm run test:simulator:e2e` passed all 17 scenarios on local Chrome using the real isolated Express router, repository, calculation/domain engine and PostgreSQL-compatible SQL fixtures. Coverage includes authenticated start, table open, notes and quantities, kitchen confirmation/ready/serve, printer failure/retry, payment and receipts, table release, save/reset/restore, disconnected transaction blocking and reconnection, committed payment response failure and idempotent recovery, browser reload, fractional deposits/withdrawals, customer QR drafts/submission/staff confirmation, zero-value settlement, autonomous ticks, inactive-window pause/resume, a 390px Thai mobile layout without horizontal overflow, real POS popup authentication and independent close, and production SQL/HTTP isolation.

The inactivity check confirmed both authoritative Auto ticks and actual WebGL draw-call counts stopped after blur and resumed after focus. The runner temporarily disables Playwright's forced focus emulation for this check; it does not change application logic. Synthetic database, browser, local HTTP and Next processes are closed during teardown. A temporary source/build cache and screenshots remain for review.

Stable local evidence: workspace `.work/simulator-online/results.json`, `desktop-service.png`, `simulated-receipt.png`, `zero-value-receipt.png`, `connection-interrupted.png`, `customer-visit.png`, `autonomous-customers.png`, and `mobile-thai.png`.

Use Node 22+, installed frontend/backend dependencies and `npm run test:simulator:e2e`. The runner owns localhost ports 3108/3109 by default and requires a Chrome/Chromium executable; `SIMULATOR_CHROME_PATH`, `SIMULATOR_E2E_FRONTEND_PORT`, `SIMULATOR_E2E_BACKEND_PORT`, and `SIMULATOR_E2E_ARTIFACTS` can override those test-only locations. It never imports the production database configuration or sends production transactions.

The development browser console reports existing-library diagnostics from Drei Html's React Strict Mode root cleanup and Three.js Clock deprecation. There were no uncaught application errors in the final scenarios. Browser screenshots use software-rendered WebGL and do not establish device GPU FPS. No claim of measured 30 FPS, Windows/iPad hardware acceptance, production PostgreSQL load capacity or complete POSAll parity is made.

## Exact changed-file inventory

### New-Yummy-go.com

```text
docs/Decisions.md
docs/Simulator.md
package-lock.json
package.json
scripts/simulator-browser.e2e.mjs
src/app/globals.css
src/app/simulator/page.tsx
src/features/pos/order-customer/order-customer-view.tsx
src/features/pos/table-selection/table-selection-page.tsx
src/features/simulator/bill-dialog.tsx
src/features/simulator/cancel-item-dialog.tsx
src/features/simulator/confirmation.tsx
src/features/simulator/deposits-panel.tsx
src/features/simulator/fields.tsx
src/features/simulator/helpers.ts
src/features/simulator/i18n.ts
src/features/simulator/live-helpers.test.ts
src/features/simulator/live-helpers.ts
src/features/simulator/live-i18n.ts
src/features/simulator/live-workspace.tsx
src/features/simulator/order-panel.tsx
src/features/simulator/product-dialog.tsx
src/features/simulator/restaurant-scene.tsx
src/features/simulator/scene-label.tsx
src/features/simulator/service-panels.tsx
src/features/simulator/simulator-launcher.tsx
src/features/simulator/simulator-page.tsx
src/features/simulator/visit-dialog.tsx
src/services/simulator/index.ts
src/services/simulator/requests.test.ts
src/services/simulator/types.ts
src/stores/simulator-live-store.test.ts
src/stores/simulator-live-store.ts
src/stores/simulator-store.test.ts
src/stores/simulator-store.ts
```

### back-end

```text
api/v1/simulator/catalog.js
api/v1/simulator/catalog.test.js
api/v1/simulator/create.js
api/v1/simulator/deposits.js
api/v1/simulator/deposits.test.js
api/v1/simulator/domain.js
api/v1/simulator/domain.test.js
api/v1/simulator/fixtures.js
api/v1/simulator/live-fixtures.js
api/v1/simulator/live.js
api/v1/simulator/live.test.js
api/v1/simulator/repository.js
api/v1/simulator/repository.test.js
api/v1/simulator/router.js
api/v1/simulator/visits.js
api/v1/simulator/visits.test.js
api/v1/url.js
docs/simulator-online-api.md
migrations/20261027_simulator_online.sql
package.json
scripts/apply-simulator-online-migration.js
```
