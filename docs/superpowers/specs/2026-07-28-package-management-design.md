# Package Management Workspace Design

**Date:** 2026-07-28  
**Route:** `/package`  
**Status:** Approved by delegated product judgment

## Goal

Build a responsive package-management workspace for Yummy Go administrators. The page must let an authenticated user understand the billing-cycle → store-type plan → package → price-detail hierarchy, create missing plans, create or update packages, search and paginate packages, and reorder only the three scopes supported by the supplied APIs.

The page is not a public pricing page. Its single job is to make package configuration safe and quick for an operator who already understands the business terms but should not need to understand backend UUID relationships.

## Product Verdict

✅ ใช้ master–detail workspace เพราะโครงสร้างข้อมูลเป็นลำดับชั้นและมีการจัดลำดับหลาย scope

⚠️ ตารางแบนใช้งานได้แต่ทำให้ความสัมพันธ์ระหว่างรอบบิล แผน และรายละเอียดอ่านยาก รวมทั้งทำให้ drag-and-drop สับสน

❌ ไม่ใช้ wizard เป็นโครงหลัก เพราะเหมาะกับการสร้างครั้งแรกเท่านั้น แต่ขัดกับ API ค้นหา pagination และ reorder ที่เป็นงานดูแลต่อเนื่อง

## Scope

### Included

- Fetch active billing cycles.
- Fetch active package methods.
- Fetch all package-plan groups.
- Fetch paginated, searchable package groups.
- Create a missing billing-cycle/method plan.
- Create a package with Lao and English names, price, status, and details.
- Update a package through the supplied `/packages/create` upsert contract by retaining `package_uuid` and existing detail UUIDs.
- Reorder billing cycles.
- Reorder plans inside one billing cycle.
- Reorder details inside one package.
- Loading skeletons, empty states, actionable errors, success/error toasts, light/dark mode, keyboard access, and touch-friendly responsive behavior.

### Excluded

- Deleting packages, plans, billing cycles, methods, or details through a standalone destructive API.
- Reordering packages; no package-reorder endpoint was supplied.
- Creating or editing billing-cycle and method master data; they are reference data on this screen.
- Hardcoding the permission sidebar. Sidebar visibility remains backend-driven.

## Information Architecture

### Desktop: two-level navigator and package workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Package management                         [Search] [Status] [+ New package] │
├──────────────────────────┬───────────────────────────────────────────────────┤
│ BILLING CADENCE RAIL     │ Selected plan                                    │
│                          │ Monthly · Professional          [+ New package]   │
│ [≡] 01 month  Monthly    ├───────────────────────────────────────────────────┤
│   [≡] Professional  ●    │ Package card: Basic                              │
│   [≡] Standard           │ 400,000 ₭ · Active                  [Edit]        │
│   [≡] Starter            │ ┌ details: reorder handles, status, translations │
│                          │ └─────────────────────────────────────────────────│
│ [≡] 12 months Yearly     │ Package card / empty invitation                  │
│   [≡] Starter            │                                                   │
│   [≡] Standard           │                                                   │
│   [+ Add store type]     │                                                   │
├──────────────────────────┴───────────────────────────────────────────────────┤
│ Showing 1–10 of 24                                  pagination full panel   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- The left rail owns billing-cycle and plan selection plus reorder controls.
- The right workspace shows packages only for the selected plan from the current API page.
- Selection changes local presentation, not the URL page number.
- Search and status apply to the backend package request.
- Pagination spans the full package content panel, excluding the application sidebar.

### Tablet and mobile: stacked selector with one vertical scroll owner

```text
┌──────────────────────────────┐
│ Package management       [+] │
│ [Search packages..........]  │
│ [Billing cycle ▾] [Plan ▾]  │
├──────────────────────────────┤
│ Selected: Monthly            │
│ Professional                 │
│                              │
│ ┌ Basic package         Edit │
│ │ 400,000 ₭ · Active         │
│ │ Features (4)               │
│ │ [≡] Support 2 branches     │
│ │ [≡] Support 10 users       │
│ └────────────────────────────│
│                              │
│ pagination                   │
└──────────────────────────────┘
```

- The page root is `h-full min-h-0 overflow-hidden`.
- Header/filter controls and pagination are `shrink-0`.
- The content region is the only `flex-1 min-h-0 overflow-y-auto overscroll-contain` owner.
- Drag handles alone use `touch-none`; the list keeps normal vertical panning.
- Mobile cards replace a horizontally oversized table.

## Visual Direction

### Subject and audience

- **Subject:** subscription packages for restaurant operators.
- **Audience:** Yummy Go administrators configuring commercial plans.
- **Single visual thesis:** the hierarchy should read like a compact price catalogue with an ordered billing-cadence rail, not like a generic CRUD spreadsheet.

### Existing semantic palette

No new theme dependency or raw page-specific color is introduced. The design uses the project tokens whose current light values are:

- **Workspace / `background`:** `#F8FAFC`
- **Primary ink / `foreground`:** `#101526`
- **Paper / `card`:** `#FFFFFF`
- **Yummy green / `primary`:** `#13805E`
- **Quiet surface / `muted`:** `#E9EEF3`
- **Divider / `border`:** `#D6DDE7`

Dark mode continues to resolve through the existing semantic variables, including the current dark workspace `#0F141A`, paper `#151B23`, and primary `#23B96C`.

### Typography

- **Display role:** Noto Sans Lao, weight 900, used only for the page title, selected package name, and price.
- **Body role:** Noto Sans Lao, weights 400–600, preserving Lao legibility and the existing application voice.
- **Utility/data role:** tabular numerals for price, month count, and pagination; monospace is reserved for technical identifiers only and UUIDs are not exposed in normal UI.

Adding another font would harm Lao consistency and increase bundle cost, so personality comes from weight, spacing, and information structure rather than a second dependency.

### Signature element

The memorable element is the **billing cadence rail**: every cycle is represented by its real month count (`01`, `12`, etc.) and connects to the ordered store-type plans beneath it. The numeric marker encodes business meaning and sorting position rather than decorating the page.

### Motion

- Selected rail/card transitions use the existing short color and border transitions.
- Dragging raises only the active item with the existing shadow token.
- No ambient or entrance animation is added.
- Motion remains usable with reduced-motion preferences because no workflow depends on animation.

### Self-critique and revision

The initial idea used a three-column pricing-card grid. That resembles a public SaaS pricing template and performs poorly when methods or packages grow. The revised master–detail design keeps the commercial hierarchy visible while matching the density and interaction patterns of the existing back-office application.

## Interaction Design

### Initial load

1. Load billing cycles, methods, plans, and the first package page in parallel.
2. Prefer the first active cycle by `sort_order`.
3. Within that cycle, prefer the first active plan by `sort_order`.
4. If the current paginated package response does not include the selected plan, keep the plan selected and show a scoped empty explanation rather than switching selection unexpectedly.

### Search and filters

- Search is submitted/debounced through the existing URL-pagination conventions and resets to page 1.
- Status values are `all`, active, and inactive.
- The API-provided `total` and `total_pages` are authoritative.
- Search does not disable billing-cycle/plan reorder because those complete reference lists are fetched separately from the paginated package result.

### Create plan

- “Add store type” opens a focused dialog.
- Billing cycle defaults to the selected cycle.
- The method selector excludes methods already connected to that cycle.
- Status defaults to active.
- Sort order defaults to the next position and is sent explicitly.
- After success, plans and packages refresh; the new plan becomes selected.

### Create or update package

- “New package” defaults to the selected plan.
- The plan field communicates billing cycle and store type together.
- Required values: plan, Lao name, English name, non-negative numeric price, and at least one detail with both translations.
- Status defaults to active.
- Detail rows can be added, removed from the draft, toggled active/inactive, and reordered before save.
- Updating retains package/detail UUIDs. New details send an empty UUID consistently.
- Closing a dirty form requires confirmation only when data would be lost.

### Reorder

- DnD supports mouse, delayed touch activation, and keyboard coordinates through the existing `useReorderSensors()` hook.
- Each sortable row also exposes move-up/move-down controls for keyboard and touch precision.
- The store applies the new order optimistically, calls the exact PATCH endpoint, rolls back on error, and background-refreshes on success.
- Billing-cycle reorder refreshes cycles, plans, and packages because all three API shapes repeat cycle ordering.
- Package cards never expose a drag handle.

## Data Architecture

```text
src/app/(protected)/package/page.tsx
  → src/features/package/package-page.tsx
    → src/stores/package-store.ts
      → src/services/package/*
        → apiRequest
```

- Route stays thin and only parses initial URL pagination.
- The feature owns presentation and dialogs.
- The Zustand store owns all async actions, request ordering, optimistic reorder, rollback, and session reset.
- The service layer owns raw DTOs, normalized domain models, query construction, payload construction, and exact endpoint calls.
- Independent initial requests run in parallel.
- Raw snake_case API fields do not leak into component props.

## Normalization Rules

- Missing nested arrays normalize to `[]`.
- Numeric strings normalize to finite numbers with safe fallbacks.
- Billing cycles, plans, packages, and details are sorted immutably by their API sort field.
- Package-response plan order uses `package_plan_sort_order`; it must not use `package_method_master_sort_order`.
- `total_pages` maps to `totalPages`.
- API language goes through `toApiLanguage()` so English requests use `eng`.
- Example mojibake from the pasted terminal text is never hardcoded.

## File Boundaries

- `src/services/package/api-types.ts`: backend response DTOs.
- `src/services/package/types.ts`: UI-safe domain models and payload interfaces.
- `src/services/package/normalizers.ts`: pure nested response normalization.
- `src/services/package/payloads.ts`: pure create/upsert/reorder payload builders.
- `src/services/package/requests.ts`: exact API calls.
- `src/services/package/index.ts` and `src/services/package.ts`: public service exports.
- `src/stores/package-store.ts`: package domain state and actions.
- `src/features/package/`: flat while small, then split into focused components once over roughly eight files.
- `src/app/(protected)/package/page.tsx`: thin route.

## Route, Shell, and Navigation

- Add `/package` to `FIXED_DATA_SCREEN_PATHS`.
- Add a fallback breadcrumb for `/package`.
- Add the path to the static route registry used by menu-management suggestions, without forcing it into the runtime sidebar.
- Runtime sidebar visibility remains supplied by the permission API.

## Accessibility

- Dialogs have visible titles and descriptions.
- Every field has a programmatic label and validation state.
- Drag handles have specific reorder labels and minimum touch targets.
- Move buttons make sorting available without pointer dragging.
- Current cycle and plan expose selected state.
- Prices use localized number formatting and preserve readable currency context.
- Focus remains visible through existing shadcn variants.
- Status is never communicated by color alone.

## Error, Empty, and Loading States

- Initial loading uses structural skeletons for the rail and package cards.
- Background refresh preserves current content and shows a compact busy indicator.
- Reference-load failure explains that plan/package creation is unavailable and exposes retry.
- Empty package results distinguish:
  - no packages exist yet;
  - no results match search/filter;
  - selected plan has no package on the current page.
- Save and reorder failures retain or restore the user's previous data and show an actionable toast.

## Testing Strategy

Component tests are not added because this project tests pure logic only.

- Normalizer tests: nested ordering, missing arrays, numeric strings, and pagination metadata.
- Payload tests: create package, update package with retained UUIDs, details, create plan, and all reorder bodies.
- Request tests: exact method, path, query, and body for the supplied API contracts.
- Store-helper tests: immutable movement and scope replacement used by optimistic reorder.
- Final verification runs once after implementation: targeted package tests, `npm run typecheck`, `npm run lint`, then the full `npm test` suite only once.

## Acceptance Criteria

- `/package` renders inside the protected application shell.
- Billing cycles and plans load, select, and reorder through their supplied endpoints.
- A missing plan can be created without allowing a duplicate cycle/method pair.
- Packages can be searched, status-filtered, and paginated using backend totals.
- A package can be created and updated with translated details.
- Price details can be reordered through the supplied endpoint.
- Package cards cannot be reordered and no unsupported destructive action is shown.
- Desktop uses master–detail layout; tablet/mobile use stacked cards.
- Tablet/mobile package content scrolls vertically while drag handles do not block ordinary scrolling.
- Pagination spans the content panel width and remains reachable.
- Light/dark mode, keyboard navigation, loading, empty, error, and validation states are present.
- No new dependency is introduced.
