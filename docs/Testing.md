# Testing

## Commands

- `npm test` — Vitest, runs every `src/**/*.test.ts` once.
- `npm run test:watch` — same, watch mode.
- `npx vitest run <path>` — a single file, e.g. `npx vitest run src/services/report/requests.test.ts`.

Config (`vitest.config.ts`): `environment: "node"`, `globals: true` (no `import { describe, it } from "vitest"` needed), `@/` aliased to `src/`. There is no jsdom/browser environment configured.

## What must be tested

Pure logic only: services, store `helpers.ts` files, validators, domain-logic files at a feature's root (e.g. `cart-domain.ts`), route/canonicalization helpers. 153 `.test.ts` files exist today, colocated next to the code they test (`foo.ts` → `foo.test.ts` in the same folder) — follow that layout, don't centralize tests in a `__tests__/` directory.

## What must not be tested

Components (`.tsx`). There's no React Testing Library, no jsdom environment, and no component test in the repo — the `node` environment in `vitest.config.ts` can't render one anyway. If a piece of component logic needs a unit test, extract it into a plain `.ts` helper/hook first (this is exactly why `hooks/` and root-level domain files are separate in the feature-folder convention — see `Rules.md`), then test the extraction.

`TODO(owner): confirm` — if component/interaction testing becomes a requirement, that's a new tooling decision (jsdom + Testing Library), not something to bolt onto the current `node`-only Vitest config ad hoc. Record it in `Decisions.md` before adding the dependency.

## Test naming and structure

Match the source file name, colocated in the same folder: `src/services/product/requests.ts` → `requests.test.ts`, `payloads.ts` → `payloads.test.ts`, `src/stores/package-store-helpers.ts` → `package-store-helpers.test.ts`. One test file per source file, not per function.

## Mocking policy

`TODO(owner): confirm` — no shared mock/fixture setup (no `__mocks__/`, no `vi.mock` convention doc) was found; each test file mocks inline as needed. Since only pure logic is tested, most tests need no mocking at all — prefer that over introducing a mocking layer.

## Coverage

`TODO(owner): confirm` — no coverage threshold is configured (no `coverage` block in `vitest.config.ts`, no CI coverage gate). Don't assume a percentage target exists; don't add a coverage gate without recording that decision first.

## Before claiming "tests pass"

Run `npm test` (or the specific `npx vitest run <path>` for the file you touched) and read the output — a summary from memory or from the diff alone is not verification. `npm run typecheck` is a separate, equally required check: Vitest does not type-check test files beyond what `tsc` catches at the IDE level.
