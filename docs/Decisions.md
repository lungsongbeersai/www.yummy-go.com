# Decisions

Append-only. Add an entry whenever a Non-negotiable in `CLAUDE.md` (or a rule in `Rules.md`/`Architecture.md`) is deliberately overridden, or a real trade-off gets settled instead of relitigated every time it comes up. Newest first.

Entries below dated from git history are backfilled from existing code comments at doc-generation time (2026-09-01) — `date` is the file's last-touched date in git, not necessarily when the decision was first made, and `approved by` is unrecorded. Both are marked `TODO(owner): confirm` where the original author/date isn't recoverable from the repo.

---

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
