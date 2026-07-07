# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Yummy Go — a restaurant POS built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Zustand, and shadcn-style local UI primitives. The same codebase ships as a web app, an Electron desktop app (with a second customer-display window), and a Capacitor Android app.

`AGENTS.md` contains the project's coding conventions — read it. Key rules: never use `any`; `interface` for props/models, `type` for unions; `as const` over enums; one Zustand store per domain with actions living in the store; components call store actions, never services directly; reuse existing components/hooks/stores/utilities before creating new ones; preserve dark mode; use AlertDialog for destructive actions.

## Commands

- `npm run dev` — Next.js dev server (Turbopack) on :3000
- `npm run dev:desktop` — dev server + Electron shell together
- `npm run typecheck` — `tsc --noEmit` (run this to verify changes; build is slow)
- `npm run lint` — ESLint
- `npm test` — Vitest, runs all `src/**/*.test.ts`
- `npx vitest run src/services/report.test.ts` — run a single test file
- `npm run build` — production Next.js build

Tests are colocated `.test.ts` files (node environment, globals enabled). They cover pure logic only — services, store helpers, validators — not components.

Deploy targets (rarely needed locally): `cf:deploy` (Cloudflare Workers via OpenNext/wrangler), `build:pages` (GitHub Pages static export with basePath `/New-Yummy-go.com`), Netlify (`netlify.toml`), `electron:pack` (Windows NSIS installer).

## Architecture

Strict layered data flow:

```
route page (thin) → feature component (src/features/<domain>/)
  → Zustand store (src/stores/<domain>-store.ts)
    → service (src/services/<domain>.ts)
      → apiRequest / publicApiRequest (src/lib/api.ts)
```

- **`src/lib/api.ts`** — two axios clients: `apiClient` (injects Bearer token + `x-access-token` from `auth-store`; a 401 triggers logout and redirect to `/login`) and `publicApiClient` (no auth). All errors are normalized to `ServiceError`. The backend wraps responses in a `{ status: "success", data, message }` envelope; `apiRequest` throws when `status !== "success"`. Backend URL comes from `NEXT_PUBLIC_BASE_URL` (see README for env vars, copy `.env.example` to `.env.local`).
- **`src/services/shared/crud.ts`** — generic `fetchList` / `fetchAll` / `saveEntity` / `deleteEntity` helpers most domain services are built from. `listParams` normalizes pagination/search/`lang` query params. Mutations are POSTs (optionally multipart via `toFormData`).
- **`src/stores/`** — one store per domain; async state follows the `AsyncSlice` shape (`loading`, `saving`, `error`) from `store-utils.ts`. `auth-store` is persisted (localStorage or sessionStorage depending on "remember me"). Larger domains (`pos-store/`, `product-store/`, `report-store/`, `public-pos-store/`) are folders with extracted, tested `helpers.ts`.
- **`src/features/`** — all substantial UI. Domain folders typically split into `list/` and `form/` (CRUD screens) or per-screen subfolders (e.g. `pos/counter-checkout`, `pos/table-selection`). Route files under `src/app/` stay thin and just render a feature component.

### Routes

- `src/app/(protected)/` — the back-office (products, sales, reports, settings, printers). Wrapped by `AuthGuard` + `AppShell` in the group layout.
- `/pos` — the cashier POS screen (protected by auth but outside the group layout/shell).
- `/q/[token]` — public QR-code customer ordering (no auth; uses `publicApiClient`, `public-pos` service/store).
- `/customer-display` — the second-screen view loaded by Electron in a separate BrowserWindow.
- `/login` — auth entry.

### Platform integrations

- **i18n** — i18next with HTTP backend; locales in `public/locales/{en,la}` (Lao is the primary language). API calls pass a `lang` param via `toApiLanguage`; the language is also stored in a cookie read by the root layout.
- **Realtime** — `src/lib/socket.ts` holds a singleton Socket.IO client; clients join a branch room (`join_branch`) and receive `table_alert` events (used for table-status alerts in POS).
- **Printing** — `src/services/printer/` abstracts receipt printing: browser/agent path (local printer agent at `NEXT_PUBLIC_PRINTER_AGENT_URL`) and Android TCP path (`@deedarb/capacitor-tcp-socket`).
- **Electron** — `electron/main.ts` (compiled to `dist-electron/` via `electron:build`) loads `http://localhost:3000`, manages the customer-display window on a chosen monitor, and relays messages between windows over IPC (`electron/preload.ts`).
- **Capacitor** — `capacitor.config.ts` + `android/` for the Android build; `Capacitor.isNativePlatform()` and the Android WebView compat helpers in `src/lib/` gate native-specific behavior.
