# Package Management Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the protected `/package` workspace for creating/updating packages, creating missing plans, fetching paginated packages, and reordering billing cycles, plans, and package details.

**Architecture:** Keep the route thin, normalize the nested snake_case API into a UI-safe service domain, centralize async state and optimistic reorder in one Zustand store, and compose the page from existing shadcn/Tailwind primitives. The page uses a fixed-height master–detail layout on desktop and one vertically scrolling stacked layout on tablet/mobile.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand, Tailwind CSS v4, local shadcn/ui primitives, i18next, Vitest, existing `@dnd-kit` packages.

## Global Constraints

- Communicate and write user-facing UI copy in Lao and English translation resources; do not hardcode the mojibake shown in the pasted API examples.
- Preserve the route → feature → Zustand store → service → `apiRequest` architecture.
- Do not add a dependency.
- Do not add delete controls or package drag-and-drop because no matching API was supplied.
- Use `toApiLanguage()` for every language query/body.
- Use backend `total` and `total_pages` for pagination; package page limit defaults to exactly `10`, with options `[10, 20, 50]`.
- Use the existing `useReorderSensors()` hook. Apply `touch-none` only to drag handles; keep content vertically pannable.
- `/package` is a fixed-data screen. The feature root is `h-full min-h-0 overflow-hidden`; the content region is the sole `flex-1 min-h-0 overflow-y-auto overscroll-contain` owner on tablet/mobile.
- Pagination spans the full package content panel, excluding the application sidebar.
- Use existing semantic color tokens and current Noto Sans Lao typography. No raw status colors, manual dark-mode palette, or new font.
- Use `FieldGroup`/`Field`, grouped `SelectItem`s, titled dialogs, `Card` composition, `Empty`, `Skeleton`, `StatusBadge`, and existing button variants.
- Write pure-logic tests before their implementations. Per the user's explicit workflow, do not execute repeated test commands during implementation; run package tests and the full suite once in the final verification task.
- Do not open a browser. The user will perform visual/device checks.

---

## File Map

### Create

- `src/services/package/types.ts` — raw DTOs, normalized domain models, request inputs, and payload types.
- `src/services/package/normalizers.ts` — pure response normalization and immutable API-order sorting.
- `src/services/package/normalizers.test.ts` — nested normalization and pagination behavior.
- `src/services/package/payloads.ts` — validated create/upsert and reorder payload builders.
- `src/services/package/payloads.test.ts` — exact payload behavior.
- `src/services/package/requests.ts` — all supplied GET/POST/PATCH calls.
- `src/services/package/requests.test.ts` — exact method/path/query/body contracts.
- `src/services/package/index.ts` — service public exports.
- `src/services/package.ts` — compatibility barrel for `@/services/package`.
- `src/stores/package-store-helpers.ts` — immutable optimistic reorder helpers.
- `src/stores/package-store-helpers.test.ts` — scope replacement and sort-order tests.
- `src/stores/package-store.ts` — package-domain Zustand store.
- `src/features/package/package-page.tsx` — feature controller and responsive shell.
- `src/features/package/package-toolbar.tsx` — search, status, refresh, and primary action controls.
- `src/features/package/package-navigator.tsx` — billing cadence rail, plan selection, and cycle/plan reorder.
- `src/features/package/package-workspace.tsx` — selected-plan package list, loading/empty states, and pagination.
- `src/features/package/package-card.tsx` — package presentation and detail reorder.
- `src/features/package/package-form-dialog.tsx` — create/update package form and draft details.
- `src/features/package/package-plan-dialog.tsx` — create missing plan form.
- `src/features/package/package-ui-utils.ts` — pure form/selection/range helpers.
- `src/features/package/package-ui-utils.test.ts` — form validation and selection helpers.
- `src/app/(protected)/package/page.tsx` — thin route and initial URL pagination.

### Modify

- `src/components/layout/app-shell.tsx` — register `/package` as a fixed-data screen.
- `src/config/menu.ts` — expose `/package` in the menu-management route registry.
- `src/config/route-breadcrumbs.ts` — add the `/package` fallback trail.
- `public/locales/en/common.json` — English `nav.package_management` and `packageManagement` namespace.
- `public/locales/la/common.json` — Lao keys with exactly the same namespace shape.
- `src/lib/i18n-resources.test.ts` — verify package namespace alignment.

---

### Task 1: Normalize the Package Domain and Build Validated Payloads

**Files:**

- Create: `src/services/package/types.ts`
- Create: `src/services/package/normalizers.test.ts`
- Create: `src/services/package/normalizers.ts`
- Create: `src/services/package/payloads.test.ts`
- Create: `src/services/package/payloads.ts`

**Interfaces:**

- Produces:

```ts
export interface BillingCycle {
  id: string;
  name: string;
  months: number;
  status: number;
  sortOrder: number;
}

export interface PackageMethod {
  id: string;
  name: string;
  status: number;
  sortOrder: number;
}

export interface PackagePlan {
  id: string;
  billingCycleId: string;
  methodId: string;
  methodName: string;
  methodStatus: number;
  status: number;
  sortOrder: number;
}

export interface PackagePlanGroup {
  billingCycleId: string;
  billingCycleName: string;
  months: number;
  status: number;
  sortOrder: number;
  plans: PackagePlan[];
}

export interface PackageDetail {
  id: string;
  packageId: string;
  name: string;
  nameLa: string;
  nameEn: string;
  status: number;
  sortOrder: number;
}

export interface PackageItem {
  id: string;
  planId: string;
  name: string;
  nameLa: string;
  nameEn: string;
  price: number;
  status: number;
  sortOrder: number;
  details: PackageDetail[];
}

export interface PackageMethodGroup {
  id: string;
  title: string;
  methodId: string;
  methodName: string;
  methodNameLa: string;
  methodNameEn: string;
  methodStatus: number;
  methodMasterSortOrder: number;
  planId: string;
  planStatus: number;
  sortOrder: number;
  packages: PackageItem[];
}

export interface PackageBillingGroup {
  id: string;
  title: string;
  billingCycleId: string;
  billingCycleName: string;
  billingCycleNameLa: string;
  billingCycleNameEn: string;
  months: number;
  status: number;
  sortOrder: number;
  methods: PackageMethodGroup[];
}

export interface PackagePageResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalBillingCycles: number;
  totalPackageMethods: number;
  groups: PackageBillingGroup[];
}

export interface CreatePackagePlanInput {
  billingCycleId: string;
  methodId: string;
  status: number;
  sortOrder: number;
}

export interface SavePackageDetailInput {
  id?: string;
  nameLa: string;
  nameEn: string;
  status: number;
}

export interface SavePackageInput {
  id?: string;
  planId: string;
  nameLa: string;
  nameEn: string;
  price: number;
  status: number;
  language?: string;
  details: SavePackageDetailInput[];
}
```

- Produces pure functions:

```ts
normalizeBillingCycles(raw: unknown): BillingCycle[]
normalizePackageMethods(raw: unknown): PackageMethod[]
normalizePackagePlanGroups(raw: unknown): PackagePlanGroup[]
normalizePackagePage(raw: unknown): PackagePageResult
buildCreatePackagePlanPayload(input: CreatePackagePlanInput): {
  billing_cycle_uuid_fk: string;
  package_method_uuid_fk: string;
  package_plan_status: number;
  sort_order: number;
}
buildSavePackagePayload(input: SavePackageInput): {
  package_uuid: string;
  package_plan_uuid_fk: string;
  package_name_la: string;
  package_name_eng: string;
  package_price: number;
  package_status: number;
  lang: "la" | "eng";
  details: Array<{
    package_price_detail_uuid: string;
    detail_name_la: string;
    detail_name_eng: string;
    detail_status: number;
  }>;
}
buildBillingCycleReorderPayload(cycles: Pick<BillingCycle, "id">[]): {
  items: Array<{ billing_cycle_uuid: string; sort_order: number }>;
}
buildPlanReorderPayload(cycleId: string, plans: Pick<PackagePlan, "id">[]): {
  billing_cycle_uuid_fk: string;
  items: Array<{ package_plan_uuid: string; sort_order: number }>;
}
buildDetailReorderPayload(packageId: string, details: Pick<PackageDetail, "id">[]): {
  package_uuid_fk: string;
  items: Array<{ package_price_detail_uuid: string; sort_order: number }>;
}
```

- [ ] **Step 1: Write normalization tests**

Use a literal fixture containing unsorted cycles, plans, packages, and details; include numeric strings and missing arrays. Assert IDs/names, ascending immutable sorting, `package_plan_sort_order` precedence, and direct `total_pages → totalPages` mapping.

```ts
it("normalizes nested package groups using plan and detail API order", () => {
  const result = normalizePackagePage({
    page: "2",
    limit: "10",
    total: "21",
    total_pages: "3",
    data: [{
      billing_cycle_uuid: "cycle-1",
      sort_order: "1",
      package_methods: [{
        package_plan_uuid: "plan-1",
        package_plan_sort_order: "2",
        package_method_master_sort_order: "1",
        packages: [{
          package_uuid: "package-1",
          package_price: "400000",
          details: [
            { package_price_detail_uuid: "detail-2", sort_order: "2" },
            { package_price_detail_uuid: "detail-1", sort_order: "1" }
          ]
        }]
      }]
    }]
  });

  expect(result).toMatchObject({ page: 2, limit: 10, total: 21, totalPages: 3 });
  expect(result.groups[0]?.methods[0]?.sortOrder).toBe(2);
  expect(result.groups[0]?.methods[0]?.packages[0]?.details.map((detail) => detail.id))
    .toEqual(["detail-1", "detail-2"]);
});
```

- [ ] **Step 2: Write payload tests**

Assert exact create-plan, create-package, update-package, and all three reorder objects. The update fixture must preserve `package_uuid` and existing detail UUIDs while new details use `""`.

- [ ] **Step 3: Implement raw DTOs and normalized domain types**

Raw DTO fields are optional `unknown` values. Do not add `any`. Reuse `text()`, `numberValue()`, `asRecords()`, `requiredText()`, `requiredUuid()`, and `requiredItems()`.

- [ ] **Step 4: Implement normalizers**

Use immutable copies. Unknown/missing arrays become `[]`. Invalid status defaults to `1`; invalid sort order defaults to `0`; invalid page metadata defaults to page `1`, limit `10`, total `0`, total pages `1`.

- [ ] **Step 5: Implement payload builders**

Validate IDs/names and finite non-negative price. Status is normalized to `1` when `Number(value) === 1`, otherwise `2`. Detail list is required and every detail requires both translations.

- [ ] **Step 6: Self-review without executing tests**

Confirm no mutation, no `any`, no mojibake literals, and every output property exactly matches the supplied API.

- [ ] **Step 7: Commit**

```powershell
git add -- src/services/package
git commit -m "feat(package): add normalized service domain"
```

---

### Task 2: Implement Exact Package API Requests

**Files:**

- Create: `src/services/package/requests.test.ts`
- Create: `src/services/package/requests.ts`
- Create: `src/services/package/index.ts`
- Create: `src/services/package.ts`

**Interfaces:**

- Consumes all Task 1 domain types, normalizers, and payload builders.
- Produces:

```ts
fetchBillingCycles(language?: string): Promise<BillingCycle[]>
fetchPackageMethods(language?: string): Promise<PackageMethod[]>
fetchPackagePlanGroups(language?: string): Promise<PackagePlanGroup[]>
fetchPackagePage(params: {
  language?: string;
  status?: "all" | 1 | 2;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: "asc" | "desc";
}): Promise<PackagePageResult>
createPackagePlan(input: CreatePackagePlanInput): Promise<void>
savePackage(input: SavePackageInput): Promise<void>
reorderBillingCycles(cycles: Pick<BillingCycle, "id">[]): Promise<void>
reorderPackagePlans(cycleId: string, plans: Pick<PackagePlan, "id">[]): Promise<void>
reorderPackageDetails(packageId: string, details: Pick<PackageDetail, "id">[]): Promise<void>
```

- [ ] **Step 1: Write request-contract tests**

Mock only `apiRequest`. Assert the exact nine endpoint contracts:

```ts
["get", "/api/v1/packages/billing_cycles", {
  params: { lang: "la", billing_cycle_status: 1 }
}]
["get", "/api/v1/packages/methods", {
  params: { lang: "la", pk_method_status: 1 }
}]
["post", "/api/v1/packages/plans/create", { data: planPayload }]
["get", "/api/v1/packages/plans/fetch", {
  params: { lang: "la", package_plan_status: "all" }
}]
["post", "/api/v1/packages/create", { data: packagePayload }]
["get", "/api/v1/packages/fetch_limit", {
  params: {
    lang: "la",
    package_status: "all",
    search: "",
    page: 1,
    limit: 10,
    orderBy: "asc"
  }
}]
["patch", "/api/v1/packages/billing_cycles/reorder", { data: cyclePayload }]
["patch", "/api/v1/packages/plans/reorder", { data: planOrderPayload }]
["patch", "/api/v1/packages/price-details/reorder", { data: detailPayload }]
```

Also assert that English becomes `eng`.

- [ ] **Step 2: Implement request functions**

Use `ApiListResponse<RawType>` or a local response interface where needed. Normalize before returning. Mutation functions return `void` after a successful `ApiMessageResponse`.

- [ ] **Step 3: Add barrels**

Export types and functions from `src/services/package/index.ts`; make `src/services/package.ts` re-export the folder API so call sites can use `@/services/package`.

- [ ] **Step 4: Self-review without executing tests**

Compare every method, URL, query key, and body key with the pasted request.

- [ ] **Step 5: Commit**

```powershell
git add -- src/services/package.ts src/services/package
git commit -m "feat(package): connect package APIs"
```

---

### Task 3: Add the Package Zustand Store and Optimistic Reorder Helpers

**Files:**

- Create: `src/stores/package-store-helpers.test.ts`
- Create: `src/stores/package-store-helpers.ts`
- Create: `src/stores/package-store.ts`

**Interfaces:**

- Produces pure helpers:

```ts
moveItem<T>(items: T[], from: number, to: number): T[]
withCycleOrder(cycles: BillingCycle[]): BillingCycle[]
replacePlanGroupOrder(
  groups: PackagePlanGroup[],
  cycleId: string,
  plans: PackagePlan[]
): PackagePlanGroup[]
replacePackageDetailOrder(
  groups: PackageBillingGroup[],
  packageId: string,
  details: PackageDetail[]
): PackageBillingGroup[]
```

- Produces store actions:

```ts
loadCatalog(query: PackageQuery, options?: { background?: boolean }): Promise<void>
loadPackages(query: PackageQuery, options?: { background?: boolean }): Promise<void>
createPlan(input: CreatePackagePlanInput, query: PackageQuery): Promise<void>
save(input: SavePackageInput, query: PackageQuery): Promise<void>
sortCycles(cycles: BillingCycle[], query: PackageQuery): Promise<void>
sortPlans(cycleId: string, plans: PackagePlan[], query: PackageQuery): Promise<void>
sortDetails(packageId: string, details: PackageDetail[], query: PackageQuery): Promise<void>
reset(): void
```

- [ ] **Step 1: Write helper tests**

Assert immutable movement, sequential `sortOrder`, replacement only inside the selected cycle/package, and preservation of unrelated groups.

- [ ] **Step 2: Implement helper functions**

Use copied arrays/objects at every changed level. Return the original values unchanged when a scope ID is absent.

- [ ] **Step 3: Implement store state**

State includes `billingCycles`, `methods`, `planGroups`, `packageGroups`, `page`, `limit`, `total`, `totalPages`, `hasLoaded`, `loading`, `refreshing`, `saving`, `sortingScope`, and `error`.

Use:

- `Promise.all()` for the four independent initial requests.
- A monotonically increasing package-load request ID so stale searches cannot replace a newer result.
- `createSessionGuard()` for every async operation.
- `registerSessionStoreReset("package", ...)`.
- Optimistic state replacement and exact rollback snapshots for all reorder actions.
- Background refresh after successful save/plan creation/reorder.

- [ ] **Step 4: Self-review without executing tests**

Confirm latest-request-wins, reset invalidates in-flight loads, failures clear busy states, and optimistic rollbacks restore the exact prior arrays.

- [ ] **Step 5: Commit**

```powershell
git add -- src/stores/package-store.ts src/stores/package-store-helpers.ts src/stores/package-store-helpers.test.ts
git commit -m "feat(package): add package management store"
```

---

### Task 4: Register the Protected Route, Shell Behavior, Menu Registry, and Translations

**Files:**

- Create: `src/app/(protected)/package/page.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/config/menu.ts`
- Modify: `src/config/route-breadcrumbs.ts`
- Modify: `public/locales/en/common.json`
- Modify: `public/locales/la/common.json`
- Modify: `src/lib/i18n-resources.test.ts`

**Interfaces:**

- Route passes:

```ts
parseUrlPagination(params, {
  defaultLimit: 10,
  limitOptions: [10, 20, 50]
})
```

- Feature receives:

```ts
interface PackagePageProps {
  initialPagination: UrlPaginationState;
}
```

- [ ] **Step 1: Extend the translation alignment test**

Add `"packageManagement"` to the aligned namespaces and assert both `nav.package_management` values are truthy.

- [ ] **Step 2: Add English and Lao resources**

The namespace contains keys for title/description, search/status labels, cycle/plan/package/detail labels, add/edit/save/cancel/refresh actions, active/inactive/all, loading/refreshing, empty/no-results/scoped-empty states, validation messages, reorder labels, range text, and success/error toasts. Both languages use identical keys.

- [ ] **Step 3: Add the thin route**

Use `PageProps<"/package">`, await `searchParams`, parse package-specific pagination, and render only `PackagePage`.

- [ ] **Step 4: Register shell and navigation metadata**

- Add `"/package"` to `FIXED_DATA_SCREEN_PATHS`.
- Add `{ path: "/package", icon: Package, title: "package_management" }` to the top-level route registry.
- Add `"/package": [{ path: "/package", title: "package_management" }]` to fallback breadcrumbs.

- [ ] **Step 5: Self-review without executing tests**

Confirm JSON validity, matching key shapes, no forced runtime-sidebar item, and the route remains in the protected group.

- [ ] **Step 6: Commit**

```powershell
git add -- 'src/app/(protected)/package/page.tsx' src/components/layout/app-shell.tsx src/config/menu.ts src/config/route-breadcrumbs.ts public/locales/en/common.json public/locales/la/common.json src/lib/i18n-resources.test.ts
git commit -m "feat(package): register package workspace"
```

---

### Task 5: Build the Responsive Package Workspace

**Files:**

- Create: `src/features/package/package-ui-utils.test.ts`
- Create: `src/features/package/package-ui-utils.ts`
- Create: `src/features/package/package-toolbar.tsx`
- Create: `src/features/package/package-navigator.tsx`
- Create: `src/features/package/package-card.tsx`
- Create: `src/features/package/package-workspace.tsx`
- Create: `src/features/package/package-page.tsx`

**Interfaces:**

- Pure helpers:

```ts
firstPlanId(groups: PackagePlanGroup[]): string
planById(groups: PackagePlanGroup[], planId: string): PackagePlan | null
packagesForPlan(groups: PackageBillingGroup[], planId: string): PackageItem[]
packageRange(page: number, limit: number, total: number, rowCount: number): {
  start: number;
  end: number;
}
availableMethods(methods: PackageMethod[], group: PackagePlanGroup | null): PackageMethod[]
```

- [ ] **Step 1: Write UI-helper tests**

Assert first sorted plan selection, plan lookup, package flattening for one plan, page range, and duplicate-method exclusion.

- [ ] **Step 2: Implement UI helpers**

Use `flatMap()` and early returns. Do not duplicate service normalization.

- [ ] **Step 3: Build the toolbar**

Compose `SearchInput`, grouped status `Select`, refresh button, and primary “New package” button. Keep controls touch-height on mobile and compact at `sm`.

- [ ] **Step 4: Build the billing cadence navigator**

Desktop uses the semantic cadence rail with real month count, selectable plan rows, drag handles, move-up/down fallback buttons, and “Add store type”. Mobile uses two grouped `Select` controls and keeps plan-management actions adjacent.

Use `DndContext`, `SortableContext`, `restrictToVerticalAxis`, and `useReorderSensors()`. Set `touch-none` only on handle buttons.

- [ ] **Step 5: Build package cards**

Use full `Card` composition. Header shows package identity, `StatusBadge`, localized price, and edit action. Content lists translated details. Existing details are sortable and have accessible move controls; package cards have no drag handle.

- [ ] **Step 6: Build workspace states and pagination**

Use:

- structural `Skeleton`s for first load;
- `Alert` with retry for load failure;
- `Empty` for no packages, no search results, and selected-plan scoped empty;
- `AppPagination` inside a full-width `shrink-0` footer;
- one content scroll owner: `min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y`.

- [ ] **Step 7: Build the page controller**

Load catalog on language/query changes, keep selected cycle/plan stable when still valid, reset selection only when removed, connect URL pagination with default `10`, and show success/error toasts for actions.

Independent derived values are calculated during render or with `useMemo`; do not mirror them in effects. Store selectors subscribe only to fields the component renders.

- [ ] **Step 8: Self-review without executing tests**

Trace desktop and mobile height chains from AppShell to content; verify only the content region scrolls, the footer remains reachable, and DnD handles do not block vertical touch panning.

- [ ] **Step 9: Commit**

```powershell
git add -- src/features/package
git commit -m "feat(package): build responsive package workspace"
```

---

### Task 6: Add Plan and Package Forms

**Files:**

- Create: `src/features/package/package-plan-dialog.tsx`
- Create: `src/features/package/package-form-dialog.tsx`
- Modify: `src/features/package/package-page.tsx`
- Modify: `src/features/package/package-workspace.tsx`
- Modify: `src/features/package/package-ui-utils.test.ts`
- Modify: `src/features/package/package-ui-utils.ts`

**Interfaces:**

- Add pure validation:

```ts
validatePlanDraft(draft: {
  billingCycleId: string;
  methodId: string;
}): "billingCycle" | "method" | null

validatePackageDraft(draft: {
  planId: string;
  nameLa: string;
  nameEn: string;
  price: string;
  details: Array<{ nameLa: string; nameEn: string }>;
}): "plan" | "nameLa" | "nameEn" | "price" | "details" | "detailNameLa" | "detailNameEn" | null
```

- [ ] **Step 1: Extend failing-first test definitions**

Add literal validation cases for missing plan, translations, negative/non-finite price, empty details, and missing detail translations. Add a valid zero-price case.

- [ ] **Step 2: Implement validation helpers**

Return the first invalid field key. Trim translations. Accept only finite price values greater than or equal to zero.

- [ ] **Step 3: Build the create-plan dialog**

Use `SettingsDialogContent/Form/Header/Body/Footer`, `FieldGroup`, grouped selects, and a status `Switch`. Default to selected cycle, exclude duplicate methods, set `sortOrder` to current plan count + 1, and disable save while saving or when no method remains.

- [ ] **Step 4: Build the create/update package dialog**

Use the same scroll-safe dialog shell. Fields include grouped plan select, Lao name, English name, `FormattedNumberInput`, status `Switch`, and an ordered detail fieldset.

Each detail draft row contains Lao/English inputs, status switch, move up/down buttons, and a remove-from-draft action. Creating a detail uses an empty UUID; editing preserves its UUID. Submission builds `SavePackageInput`.

- [ ] **Step 5: Connect form actions**

Opening from the toolbar creates against the selected plan. Opening from a package card maps the full existing package and details into the draft. On successful save, close the dialog, retain selection, and background-refresh package results.

- [ ] **Step 6: Self-review without executing tests**

Check label/control connections, dialog titles/descriptions, validation `data-invalid` plus `aria-invalid`, dirty-close protection, minimum touch targets, disabled/busy behavior, and stable detail keys generated once per draft row.

- [ ] **Step 7: Commit**

```powershell
git add -- src/features/package
git commit -m "feat(package): add package and plan forms"
```

---

### Task 7: Final Review and One-Time Verification

**Files:**

- Modify only files required by review findings.

- [ ] **Step 1: Inspect the complete diff**

```powershell
git status --short
git diff --check
git diff (git merge-base main HEAD)..HEAD --stat
```

Confirm there are no unrelated user changes, unsupported endpoints, raw `any`, duplicated package sorting, or hardcoded broken Lao text.

- [ ] **Step 2: Run package tests once**

```powershell
& 'C:\Program Files\nodejs\npx.cmd' vitest run src/services/package/normalizers.test.ts src/services/package/payloads.test.ts src/services/package/requests.test.ts src/stores/package-store-helpers.test.ts src/features/package/package-ui-utils.test.ts
```

Expected: every package test passes with zero failures.

- [ ] **Step 3: Run static verification**

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Expected: both commands exit `0`.

- [ ] **Step 4: Run the full test suite exactly once**

```powershell
npm.cmd test
```

Expected: all Vitest files pass with zero failures.

- [ ] **Step 5: Perform final code review**

Review against `docs/superpowers/specs/2026-07-28-package-management-design.md`, with special attention to exact API contracts, latest-request-wins behavior, optimistic rollback, status semantics, i18n alignment, responsive height/overflow ownership, keyboard DnD, and no unsupported actions.

- [ ] **Step 6: Address findings and re-run only the affected verification**

Any production correction gets a focused regression test when it affects pure logic. Re-run the smallest affected package test plus `typecheck`/`lint`; do not run the full suite a second time unless a shared test failure requires it.

- [ ] **Step 7: Commit verified integration**

```powershell
git add -- src public docs
git commit -m "feat(package): complete package management workspace"
```

Only create this commit when uncommitted implementation/review fixes remain.
