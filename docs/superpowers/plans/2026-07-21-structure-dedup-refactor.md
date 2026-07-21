# Structure & Dedup Refactor Plan (post-Next 16)

Source: 7-slice read-only audit, 2026-07-21 (81 findings; full data in session transcript).
Scope: the owner's mandate — Next 16 best practices, clean structure/naming, consolidate duplicated code.
State at audit: Next 16.2.10 green (typecheck / 595 tests / build); 22 lint errors left (all `react-hooks/set-state-in-effect`).

**Estimated net deletion: ~7,000–8,800 lines (~7–9% of 97k non-test lines).**
Biggest pools: settings CRUD ~2,500–3,500 · report triplets ~2,600–3,200 · services/stores ~950–1,000 · pos forks ~900–1,100.

Rules for every batch: one commit per batch; verify with `npm run typecheck` + `npm test` (+ `npm run lint`); `npm run build` at the end of each phase. No behavior change unless the batch says so explicitly.

## Owner decisions needed before the marked batches

| # | Decision | Options (recommendation first) | Blocks |
|---|---|---|---|
| D1 | Currency label on public menu vs staff POS (`LAK` vs `₭`) | Unify on one (rec: `₭` staff, `LAK` public stays — i.e. keep both, document; or unify) | P3.3 |
| D2 | Page `<title>` language | Lao-primary (rec) or English | P1.2 |
| D3 | Internal route renames (`/setting→/settings`, `/product→/products`, `/printer→/printers`, cashier under `/pos/*`) — old bookmarks break unless redirects added | Do it with redirects in next.config (rec) | P2.1 |
| D4 | Profile page save/password buttons are fake (toast, no API call) | Disable with "coming soon" (rec) or wire to user service | P1.7 |
| D5 | Root layout `await cookies()` keeps /home /policy dynamic | Accept & document (rec) — revisit only if marketing pages need static | — |

## Phase 0 — Guardrails (do first, in this order)

- **P0.1** `typedRoutes: true` in next.config.ts; fix surfaced string hrefs. Every later rename becomes compile-checked. (impact high)
- **P0.2** Zero-importer deletions: `services/posPublic.ts`, `services/crud.ts`, `services/types.ts`, `stores/index.ts`, `features/pos/order-customer/order-customer-route.tsx`; drop dead `generateStaticParams` in `setting/[entity]`; merge typo `services/unite.ts` → `unit.ts` (endpoint strings stay).
- **P0.3** Freeze conventions in CLAUDE.md/AGENTS.md: subfolder rule (flat until >8 files → `components/` + `hooks/`), client-auth decision (no proxy.ts; middleware.ts is deprecated in 16), canonical import forms.

## Phase 1 — Mechanical quick wins (all S/M, test-verified)

- **P1.1** Next 16 wrappers: 22 pages → generated `PageProps<'/route'>` (kills ~200 dup lines); add missing Suspense on `/product/form`; theme bootstrap → plain inline `<script>`.
- **P1.2** Metadata: title template in layout + per-route titles (needs **D2**); fix English-hardcoded daily-closing title.
- **P1.3** Lint backlog, safe-mechanical third: category-scroll rAF deferral; product-browse layout mode via `useSyncExternalStore`; shared `useMediaQuery` hook + sales-list reset. (22 → ~15 errors)
- **P1.4** Services: `reportRequest<T>` helper in report.ts (−70); `shared/normalize.ts` for the 3 permission services (−100); `AsyncSlice` actually extended where the trio exists; one lang-param convention; permission-menu on `saveEntity/deleteEntity`; merge duplicate table-QR request.
- **P1.5** POS small dedup: shared `prefersReducedMotion()`; value-helpers imported from `@/lib/values` directly; delete invoice-print pass-through barrel; delete always-true `isVisibleCartItem`.
- **P1.6** Report small dedup: shared `report-metrics.ts` + payment-method options (kills formatNumber ×4, waitForPaint ×4, displayMetric ×3); move 7 root shared modules into `report/shared/`; rename daily-sales' collision-prone generic export names; receipt-print helper polish; reformat the inflated daily-closing workflow.
- **P1.7** Settings small wins: exchange-store → `createCrudListStore` (regains race guard); retire `settings-store.ts` + adapters (14/16 dead); fold `[entity]` dynamic route into 4 static routes; pagination helpers → `src/lib/pagination.ts`; policy page copy → i18n; profile fake-save per **D4**.

## Phase 2 — Structure & routes

- **P2.1** Route renames (after P0.1, per **D3**): `setting→settings` (51 strings), `product→products` (13), `printer→printers` (9), `(protected)/sale/order-customer → (protected)/pos/order`, `(protected)/sales/open-table-sale → (protected)/pos/tables`. Public `/pos?t=` URL is FROZEN (printed QR codes). Update CLAUDE.md route docs same commit.
- **P2.2** Shared-code moves (git-mv + import rewrites): report export machinery → `src/lib/export/` (excel/pdf/official-layout/paint — unblocks stock's 6 cross-feature imports); `escapeHtml` → lib; `invoice-print-window` → `services/printer/`; decompose the three giant grab-bag `utils.ts` (public-pos 1,321 / table-selection 1,036 / order-customer 894) into named modules with temporary re-export barrels; flatten 6 single-file wrapper folders; move 3 single-consumer hooks into their features.
- **P2.3** Permission naming unification: `permission-menu` + `store-permissions` + `sidebar-menu` → one `permissions` root word across services/stores/features/routes.

## Phase 3 — Consolidation engines (the big dedup; each sub-batch separately verified)

- **P3.1 Settings CRUD kit** (~−2,500–3,500): extract `useSettingsCrudController` from the proven `OptionSettingsPage` factory + `renderFormDialog` slot → migrate customer/currency/exchange/category (mechanical), then table/user/store-branch/location (controller adoption).
- **P3.2 Report kit** (~−2,600–3,200): `useStandardReportWorkflow` config factory (3 hooks are 75% identical); `useReportExportActions` (exportPdf/printReport char-identical ×3); `ReportTableCard`, filter-field kit, `ReportPageShell`, metric-display module; `createPagedReportStore` factory + split the 967-line report-store into per-domain files behind a barrel. Reference impl: payment-methods → category-sales → best-selling; daily-sales adopts shared row-selection/pagination.
- **P3.3 POS domain layer** (~−900–1,100): `src/lib/pos/{product-selection,product-pricing,cart-items,product-media,order-input}.ts` merging the 19+ forked function pairs; unify `PUBLIC_MENU_KIND` onto `ProductSortStatus`; currency label per **D1**. ⚠️ Revenue path: pure moves are mechanical; predicate/payload merges get per-function diffs + fixture-locked payload equality tests before call-site swaps.
- **P3.4 Monolith splits**: printer.ts (1,211) → `services/printer/{types,config-api,agent-transport,print-jobs}` behind index barrel (also breaks its circular import); monolith stores gain tested `helpers.ts` (public-pos session-cache, store-permissions, printer).
- **P3.5 Lint backlog remainder** (→ 0 errors): product-form 6 (ref + `useResetOnDeps` conversions), order-customer 3 (incl. moving the menu-state cluster into pos-store — fixes lint + layering together), menu-browse 3, bootstrap 2, cancel-sale 2, table-selection zoneOptions → pos-store, selected-table-cart split. Each needs targeted manual QA (flows listed in audit).

## Phase 4 — Deep normalization (most invasive; schedule per appetite)

- **P4.1** API snake_case leak (`prod_uuid` ×42 in .tsx, 40 feature files): map to camelCase domain models at the service boundary, per-domain starting with pos. High impact, largest churn — do after Phase 3 stabilizes.
- **P4.2** Product option form + responsive Sheet/Dialog overlay unification (visual, per-platform side-by-side QA).
- **P4.3** Printer list/form page splits into hook + surface files (mirror stock feature pattern).

## Explicitly rejected / deferred

- No `proxy.ts` — auth is client-side by design (localStorage token; Electron/Capacitor shells). Documented in P0.3.
- `window-open-fonts` render-blocking link: accept with comment (only /customer-display needs it in-document).
- Electron hardening items (single-instance lock, runtime pruning, crash surfacing) tracked separately from this plan.
