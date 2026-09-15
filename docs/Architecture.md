# Architecture

Boundaries and data flow that are already settled. Propose changes to this file only through `Decisions.md`, not silently.

## Layered data flow

```
route page (thin, src/app/)
  → feature component (src/features/<domain>/)
    → Zustand store (src/stores/<domain>-store.ts)
      → service (src/services/<domain>.ts)
        → apiRequest / publicApiRequest (src/lib/api.ts)
```

Each arrow is a one-way dependency. A layer may only call the layer directly below it — a feature component never imports a service, a route file never imports a store. This keeps every layer independently testable and means a backend contract change touches exactly one service file, not every screen that uses it.

## `src/lib/api.ts` — the only HTTP boundary

Two Axios clients, both created by `createClient()`:

- **`apiClient`** (authenticated) — injects `Authorization: Bearer` and `x-access-token` from `auth-store`; a response interceptor calls `shouldLogoutForUnauthorized()` and, if true, logs out and redirects to `/login`.
- **`publicApiClient`** (no auth) — used by `/posAll` and `/q/[token]`.

The backend wraps every response as `{ status, data, message }`. `assertApiSuccess()` throws a `ServiceError` when `status !== "success"`, so callers only ever see a resolved value or a thrown `ServiceError` — never a raw envelope. `NEXT_PUBLIC_BASE_URL` sets the origin (copy `.env.example` → `.env.local`).

`apiRequest()` and `publicApiRequest()` are **online-only**: every request goes directly to Backend and a transport failure is returned to the caller instead of becoming a local success. The NetworkManager may still describe reachability for diagnostics, but it cannot route reads or writes to Agent SQLite/Dexie. Login uses an 8-second bound; other API calls retain their established timeout so slow uploads are not regressed during this cutover.

## Services

- **`src/services/shared/crud.ts`** — generic `fetchList` / `fetchAll` / `saveEntity` / `deleteEntity` most domain services are built from. `listParams` normalizes pagination/search/`lang`. Mutations are POSTs, optionally multipart via `toFormData`.
- Small domains stay one file (`product.ts`-style). Larger domains (`pos/`, `product/`, `package/`, `printer/`, `public-pos/`, `permissions/`, `shared/`) are folders: `requests.ts` (API calls), `types.ts`, `index.ts` barrel, plus `payloads.ts` / `normalizers.ts` / `validators.ts` as needed.
- Other code always imports from the folder root (`@/services/pos`), never a deep path — the barrel is the contract, internal file splits are free to change.

## Stores

- Async state follows the `AsyncSlice` shape (`{ loading, saving, error }`) from `src/stores/store-utils.ts`. `errorMessage()` there is the one place that turns a thrown value into a display string.
- `auth-store` is persisted via Zustand's `persist` middleware to localStorage or sessionStorage depending on "remember me" (`createJSONStorage` + a custom `StateStorage`).
- Larger domains (`pos-store/`, `product-store/`, `report-store/`, `public-pos-store/`, `cancel-store/`) are folders with pure, tested `helpers.ts` extracted out of the store body — put branching logic there, not inline in actions, so it's unit-testable without mounting Zustand.

## Features

`src/features/<domain>/<screen>/` holds all substantial UI. Stays flat until it exceeds ~8 files, then splits into `components/` and `hooks/`. `public-pos/order` is the reference shape for a fully split feature (domain logic in flat `.ts` files at the folder root — `cart-domain.ts`, `product-domain.ts` — UI in `components/`, orchestration in `hooks/`). CRUD domains typically split into `list/` and `form/` instead.

Import via the `@/` alias; do not reach across feature boundaries with `../`.

## Routes

- `src/app/(protected)/` — back office (`/products`, `/sales/*`, `/report/*`, `/settings/*`, `/printers`) plus cashier POS (`/posAll/order`, `/posAll/tables`). Wrapped by `AuthGuard` + `AppShell`.
- `/posAll` — public QR-code ordering entry, **top-level**, outside `(protected)` and outside auth. `/q/[token]` is the stable URL printed on physical table QR codes and redirects here with `?t=`. Route groups add no URL segment, so this is a sibling of `/posAll/order` and `/posAll/tables`, not their parent.
- `/posAll`, `/posAll/order`, and `/posAll/tables` are the only active Frontend POS page URLs. Every active sales API call uses the Backend `/api/v1/posAll/*` namespace; the retired Frontend `/pos*` pages and Backend `/api/v1/pos/*` namespace must not be restored.
- `/q/[token]` — stable public QR-code URL, redirects to `/posAll?t=:token`. No auth; uses `publicApiClient` and the `public-pos` service/store.
- `/customer-display` — second-screen view, loaded by Electron in its own `BrowserWindow`.
- `/login` — auth entry.
- Legacy pre-P2.1 paths (`/setting*`, `/product*`, `/printer*`, `/sale/order-customer`, `/sales/open-table-sale`) redirect via `redirects()` in `next.config.ts`. The permission API still returns these legacy paths at runtime — `src/lib/routes.ts` (`canonicalRoute`, `internalRoute`) is the single place that rewrites them to current paths for menu highlighting; it must stay in sync with `redirects()` by hand (verified last touched together: 2026-07-28 / 2026-08-31 — no automated check links them, see `Decisions.md`).

## Platform integrations

- **i18n** — i18next with an HTTP backend; locales in `public/locales/{en,la}` (Lao is primary). API calls pass `lang` via `toApiLanguage`; the active language is also cookied for the root layout.
- **Realtime** — `src/lib/socket.ts` holds a singleton Socket.IO client. Clients join a branch room (`join_branch`) and receive `table_alert` events for POS table-status alerts.
- **Printing** — `src/services/printer/` abstracts receipt printing over two transports: browser/agent (Local Printer Agent at `NEXT_PUBLIC_PRINTER_AGENT_URL`, default `http://127.0.0.1:7777`) and Android TCP (`@deedarb/capacitor-tcp-socket`). Android has no Local Printer Agent — see Offline.
- **Online-only cutover** — sales, cart, kitchen confirmation, QR, payment and all reads/writes require Backend. `providers.tsx` runs the one-way browser cleanup: unregister every old service worker, delete Cache Storage, delete the retired Dexie database, and remove offline device/recovery markers. `public/offline-sw.js` is intentionally a small self-unregistering tombstone so browsers controlled by an older worker can receive and activate the retirement. Legacy offline modules remain source-compatible during the rollout but are not mounted or called from the HTTP, login, POS navigation, or mobile printing paths. Printer Agent remains the transport for online USB/Wi-Fi jobs; it is not a sales database.
- **Electron** — `electron/main.ts` (compiled to `dist-electron/` via `electron:build`) loads the dev server in development; packaged, it launches the staged standalone Next server via `utilityProcess` (`src/platform/electron/next-server-contract.ts`). It manages the customer-display `BrowserWindow` on a chosen monitor and relays messages between windows over IPC (`electron/preload.ts`).
- **Capacitor** — `capacitor.config.ts` + `android/`. `Capacitor.isNativePlatform()` and the Android WebView compat helpers in `src/lib/` gate native-only behavior.

## Settled decisions this file assumes

See `docs/Decisions.md` for the Online-only cutover and the LAN `allowedDevOrigins` entry in `next.config.ts`. The historical service-worker/offline decisions remain in that append-only log but are superseded by the 2026-09-14 Online-only decision.
