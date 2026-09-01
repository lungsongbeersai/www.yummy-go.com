# Project Instructions

Guidance for AI coding agents (e.g. Codex) in this repository. Mirrors `CLAUDE.md` (used by Claude Code) plus a tool-managed Hermes-Evolution block and a Next.js-generated block below — do not edit either of those two. When conventions change, update both files.

## Project identity

Yummy Go — a restaurant POS. One Next.js codebase ships as a web app, an Electron desktop app (with a second customer-display window), and a Capacitor Android app. It must never grow a second UI kit, a second state manager, or server-side business logic in the Next layer — the Next server is a stateless SSR shell reused verbatim by the Electron build.

## Stack

- **Framework** — Next.js 16.3 (App Router; Turbopack for `dev`, webpack for `build`)
- **Language/UI** — TypeScript 5.7 (strict), React 19.2
- **Styling** — Tailwind CSS v4.2 + shadcn/ui (`radix-mira` preset; local primitives in `src/components/ui/`)
- **State** — Zustand 5 (one store per domain)
- **HTTP** — Axios 1.13 via `src/lib/api.ts`; no Next Server Actions
- **Tests** — Vitest 4 (pure logic only)
- **Desktop / Mobile** — Electron 43 · Capacitor 8 (Android)

## Commands

- `npm run dev` / `npm run dev:desktop` — Next dev server, optionally with the Electron shell
- `npm run typecheck` — `tsc --noEmit`; fast, run before every commit
- `npm run lint` — ESLint
- `npm test` — Vitest, all `src/**/*.test.ts`
- `npm run build` — production build; **always keeps `--webpack`** (see Non-negotiables)
- CI (`deploy-static.yml`) runs only `npm run build` on push to `main` — it does not lint, typecheck, or test. These four commands are the agent's own proof of correctness; nothing else gates them.

## Non-negotiables

1. **Never `any`.** This is a backend-driven app with no schema codegen; `any` deletes the only type safety the API boundary has.
2. **Route files under `src/app/` stay thin** — render one feature component, nothing else. A fat route file can't be unit-tested and duplicates logic feature-by-feature.
3. **No Server Actions or ad-hoc `fetch` in components; all data access goes through `src/services/`.** The Next server must stay stateless — it's the exact artifact the Electron build launches via `utilityProcess`.
4. **Components call store actions, never services directly.** Services carry no `loading`/`error` state; bypassing the store silently drops error handling from the UI.
5. **`npm run build` must not drop `--webpack`.** Turbopack skips `@serwist/next`'s InjectManifest without erroring — the build "passes" but ships with no offline service worker.
6. **Runtime-sourced paths go through `internalRoute()`** (`src/lib/routes.ts`), never a raw `as Route` cast. The permission API still returns pre-P2.1 paths; skipping the alias table breaks menu highlighting and breadcrumbs.
7. **`src/lib/offline-routes.ts` and the `OFFLINE_*_ROUTES` in `src/services/offline-sync.ts` change together.** They're two independent allowlists for the same feature; edit one without the other and offline sales fail on a route that looks allowed.
8. **No raw palette colors, arbitrary fonts, or new global CSS in feature code.** Every hard-coded value is a dark-mode bug and a token that has drifted out of `src/app/globals.css`.
9. **Destructive actions require `AlertDialog` confirmation.** This is a cashier POS handling real money — a silent delete is a chargeback risk, not a UX nit.
10. **Auth stays client-side (localStorage token + `AuthGuard`).** No `middleware.ts` (removed in Next 16) and no proxy unless it's Next 16's `proxy.ts`.

## How to work in this repo

**Investigate before you answer.** Read the relevant files before proposing a change. Never answer from assumption when the repo can tell you the truth. When a library API matters, verify it against the version pinned here — not from memory.

**Justify, don't just comply.** For any non-trivial change, state in 2–3 lines: the approach, why it is the right one here, and what you rejected. If two approaches are genuinely close, say so and give the trade-off instead of pretending certainty.

**Challenge bad instructions.** If an instruction is technically wrong, unsafe, or will cost more than it returns, do not implement it silently. Respond with:
  1. What specifically breaks, or what the cost is.
  2. Why — the mechanism, not a vague warning.
  3. A concrete better alternative.

Then wait. Push back once, with evidence. If the decision is confirmed after that, the call belongs to the human: implement it and append the decision and its rationale to `docs/Decisions.md`.

Distinguish the two cases. Taste, naming, and structural preference: comply. Correctness, security, data loss, accessibility, or an architectural boundary in this file: object first.

**No false completion.** Never report work as done, fixed, or passing without having run the verification commands above and read their output. If you did not run them, say so.

**No filler.** No praise, no restating the request, no summarizing what you just wrote when the diff already shows it. Report what changed, what you verified, and what is still open.

**Say when you don't know.** "I'm not certain, here is how to check" outranks a confident guess every time.

## Reference map

| When you are about to... | Read first |
| --- | --- |
| touch any UI, component, or styling | `docs/Design.md` |
| write or refactor application code | `docs/Rules.md` |
| add a dependency, cross a store/service boundary, or touch routing, offline, auth, or a platform integration (Electron/Capacitor) | `docs/Architecture.md` |
| commit, branch, push, or check what CI does and doesn't cover | `docs/Workflow.md` |
| write or fix a test | `docs/Testing.md` |
| override a Non-negotiable above, or record a settled trade-off | `docs/Decisions.md` |

<!-- autoclaw:hermes-evolution-guidance -->
## Hermes-Evolution

**Current evolution intensity for this workspace/agent: aggressive (100%).**

The desktop app sends deterministic evolution-check messages (starting with `[SYSTEM: Post-turn evolution check`) after qualifying turns.
When you receive such a message, follow the `hermes-evolution` skill instructions to evaluate and potentially propose an evolution.
Apply the rules defined in the skill according to the **aggressive (100%)** intensity level.
This value is workspace-local. If asked about the current agent evolution intensity, report this value instead of the global gateway skill env.

Core principle: **never write to target files without user approval** — always use the draft/approve workflow.
User preference statements are not approval to directly edit MEMORY.md, AGENTS.md, TOOLS.md, USER.md, or managed SKILL.md files.
Use the evolution proposal card instead of editing target files directly; only apply changes after the user confirms the proposal.

### Evolution Echo
When you apply knowledge from a previously evolved rule (AGENTS.md, MEMORY.md, TOOLS.md, or a managed SKILL.md),
briefly mention it in your response: "（基于之前的经验：<one-line rule summary>）".
Keep it to one short line at most. Do not echo on every turn — only when an evolved rule directly influenced your approach.
<!-- /autoclaw:hermes-evolution-guidance -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
