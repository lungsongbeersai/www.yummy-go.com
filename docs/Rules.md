# Rules

Coding standards ESLint/TypeScript can't enforce. Format: **Rule → Why → Correct → Wrong.**

## TypeScript

**Rule.** Never `any`. Use `unknown` and narrow it, or model the real shape.
**Why.** This app talks to an external backend with no generated types (`src/services/*/types.ts` is hand-written) — `any` at any point in that chain silently swallows every mistake downstream of it.
**Correct**
```ts
function normalizeError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  ...
}
```
**Wrong**
```ts
function normalizeError(error: any) { return error.message; }
```

---

**Rule.** `interface` for props and API/domain models; `type` for unions, aliases, and mapped/derived types; `as const` instead of TypeScript `enum`.
**Why.** Matches the whole codebase (`src/services/*/types.ts`, `AuthUser` in `auth-store.ts`) and avoids `enum`'s non-tree-shakeable runtime object.
**Correct** (from `src/services/pos`)
```ts
export const ProductSortStatus = { NORMAL: "normal", SET: "set", PROMOTION: "promotion" } as const;
export type ProductSortStatus = (typeof ProductSortStatus)[keyof typeof ProductSortStatus];
```
**Wrong**
```ts
enum ProductSortStatus { NORMAL, SET, PROMOTION }
```

## Zustand stores

**Rule.** One store per domain; store actions call services, components call store actions — never the reverse and never skip a layer.
**Why.** Services throw a bare `ServiceError`; only the store's `AsyncSlice` (`loading`/`saving`/`error`) turns that into UI-visible state. A component calling a service directly gets no loading state and no error surface.
**Correct** (`src/stores/pos-store.ts`)
```ts
import * as posService from "@/services/pos";
// ...inside the store action:
set({ loading: true });
const data = await posService.getPosMenu(params);
```
**Wrong**
```ts
// inside a component
import { getPosMenu } from "@/services/pos";
const data = await getPosMenu(params); // no loading/error state, bypasses the store
```

---

**Rule.** Before writing a new CRUD store, check `createCrudListStore` (`src/stores/crud-list-store.ts`).
**Why.** Most list+save+delete domains are the same shape. `category-store.ts` is the whole store in 10 lines because of this factory — a hand-rolled equivalent is ~80 lines of duplicated `AsyncSlice` wiring.
**Correct**
```ts
export const useCategoryStore = createCrudListStore<Category, SaveCategoryInput, FetchCategoriesParams>({
  idKey: "cate_uuid", list: getCategories, save: saveCategory, remove: deleteCategory
});
```
**Wrong.** Reimplementing `loading`/`saving`/`error` and list-mutation logic from scratch for a domain that's plain list/save/delete.

## Services

**Rule.** Import a service folder from its barrel (`@/services/pos`), never a deep file (`@/services/pos/requests`).
**Why.** The barrel is the contract; `requests.ts`/`payloads.ts`/`validators.ts` splits are internal and change shape as a domain grows. Deep imports break the moment that internal split changes.
**Correct** `import * as posService from "@/services/pos";`
**Wrong** `import { getPosMenu } from "@/services/pos/requests";`

---

**Rule.** Build new list/save/delete services from `src/services/shared/crud.ts` (`fetchList`, `fetchAll`, `saveEntity`, `deleteEntity`), not bespoke Axios calls.
**Why.** These helpers already normalize pagination/search/`lang` params (`listParams`) and multipart handling (`toFormData`) the same way every other domain does — a bespoke call silently drifts from that contract (e.g. forgets `lang`, breaks list search).

## Next.js / routing

**Rule.** Route files under `src/app/` render exactly one feature component; put logic in `src/features/`.
**Why.** A route file can't be unit-tested and duplicates logic per-route the moment two routes need the same behavior.

**Rule.** Cast a path to `Route` only inside `internalRoute()` (`src/lib/routes.ts`) — never `as Route` at a call site.
**Why.** Permission-API paths are pre-P2.1; `internalRoute()` runs them through `canonicalRoute()` first. A raw cast at a call site skips that rewrite and silently breaks menu highlighting for anyone still on a legacy path.

## Feature folders

**Rule.** `src/features/<domain>/<screen>/` stays flat until ~8 files, then splits into `components/` and `hooks/`. Domain-logic files (pure `.ts`, no JSX) live at the feature root, not inside `components/`.
**Why.** `public-pos/order` is the reference: `cart-domain.ts` / `product-domain.ts` are plain, fully unit-tested TypeScript; nothing in `components/` needs a DOM to test business logic.
**Correct.** New pure cart-total logic → `src/features/pos/counter-checkout/cart-totals.ts` + a colocated `.test.ts`.
**Wrong.** The same logic inline inside a `.tsx` component, untestable without mounting React.

**Rule.** Import via `@/`; never `../` across a feature boundary (`src/features/a/../b`).
**Why.** Cross-feature relative imports create hidden coupling between domains that are supposed to be independently deletable.

## Comments

**Rule.** Comment the *why* — a business rule, a workaround, a constraint that isn't visible in the code itself. Never restate what the code already says.
**Why.** This codebase already does this well (see `next.config.ts`, `offline-routes.ts`) — comments there explain non-obvious constraints (Windows path separators breaking the SW manifest, why Android can't do offline writes), not "loop over items."
**Correct**
```ts
// InjectManifest (classic mode) uses webpack only — Turbopack silently skips the
// plugin instead of erroring, so `build` must force --webpack or offline-sw.js never ships.
```
**Wrong** `// loop through the categories and sum products`
