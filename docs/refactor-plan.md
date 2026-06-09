# Refactor Plan

This plan keeps the project maintainable, understandable, performant, and aligned with `AGENTS.md`. The goal is incremental refactor work, not a rewrite. Existing parts that are already clean, tested, and easy to understand should be preserved.

## Principles

- Keep behavior unchanged unless a phase explicitly calls out a product change.
- Prefer clear, easy-to-understand code over the shortest possible code.
- Work one domain or one large workflow at a time.
- Reuse existing components, hooks, utilities, stores, and services before adding new patterns.
- If there is a suitable library, install it directly instead of custom-building it.
- Use React Server Components by default. Use Client Components only for state, effects, browser APIs, or Zustand.
- UI work must use the local shadcn/ui workflow first and should stay aligned with the `new-york` style.
- Service-backed UI workflows should call Zustand store actions instead of importing services directly.
- Do not refactor files just because they exist. Touch only the parts that reduce real maintenance cost.

## Current Baseline

Latest baseline commands passed on June 9, 2026:

```bash
npm run typecheck
npm test
npm run lint
```

Observed baseline:

- `npm run typecheck` passed.
- `npm test` passed with `45` test files and `230` tests.
- `npm run lint` passed.
- After the final consistency pass, `git status --short` contains the expected docs/product/settings/dashboard/UI cleanup/dependency cleanup/test guard/sales/POS/public POS refactor files plus pre-existing unrelated dirty files that were preserved.
- Report export loader tests are now part of the baseline coverage.
- Product list utility tests are now part of the baseline coverage.
- Settings config/adapter boundary tests are now part of the baseline coverage.
- Dashboard view-model and chart boundary tests are now part of the baseline coverage.
- Project refactor guard tests are now part of the baseline coverage.
- Sales list helper tests are now part of the baseline coverage.
- POS table-selection utility tests now cover split-selection pruning used by the cart panel workflow.
- Most route files in `src/app` are already short wrappers around feature pages.
- The project already has useful domain folders under `src/features`, `src/stores`, and `src/services`.
- The largest maintenance pressure is concentrated in large feature pages, workflow hooks, report/dashboard components, POS flows, and settings CRUD.

## Completed Progress

- Step 1 first pass is complete for generic settings CRUD: size, group, unit, topping, zone, and color now share option settings helpers instead of repeating the same page workflow.
- Step 2 report boundary pass is complete for daily sales, best-selling products, and payment methods.
- Report export workflows now call store `loadExportData` actions. Feature workflow hooks no longer import report service fetch functions directly for export data.
- Step 3 product first pass is complete for product list and product form workflow. The product list is split into workflow, table, mobile, action, status, and media modules; the product form workflow is split into reference data, image, detail, set option, and topping hooks while keeping the `ProductFormWorkflow` shape stable.
- Step 4 first pass is complete for settings config/store boundary. Settings metadata is separated from service-backed actions, and the settings store resolves list/save/remove behavior through store-layer adapters.
- Step 4 specialized settings first pass is complete for store/branch settings. `store-branch-settings-page.tsx` remains the workflow root, while labels, list surface, and form dialog UI live in focused modules.
- Step 4 specialized settings first pass is complete for location settings. `location-settings-page.tsx` remains the workflow root, while the list surface, form dialog, and province combobox UI live in focused modules.
- Step 4 specialized settings first pass is complete for table settings. `table-page.tsx` remains the workflow root, while grouped table list UI, form dialog UI, and shared table display pieces live in focused modules.
- Step 4 specialized settings first pass is complete for user settings. `user-page.tsx` remains the workflow root, while pure user helpers, user display pieces, list UI, and form dialog UI live in focused modules.
- Step 4 specialized settings first pass is complete for currency settings. `currency-page.tsx` remains the workflow root, while currency display pieces, list UI, form dialog UI, and flag picker UI live in focused modules.
- Step 4 specialized settings first pass is complete for category settings. `category-page.tsx` remains the workflow root, while category display pieces, list UI, and form dialog UI live in focused modules.
- Step 5 dashboard first pass is complete. Chart-heavy dashboard grids now live in a chart module loaded with `next/dynamic`, while lightweight dashboard header/filter/hero/footer UI stays in `dashboard-widgets.tsx`.
- Dashboard model normalization now caches fallback row reads instead of repeating the same `asRows(...)` work during model creation.
- Step 6 first pass is complete as a targeted shadcn/UI pattern cleanup. It removed concrete feature-level `space-y-*` and custom `animate-pulse` loading patterns found in product toppings, POS cart loading, and public POS skeletons without redesigning those screens.
- Step 7 first pass is complete for dependency and asset noise cleanup. Unused `chart.js` was removed, Recharts remains the chart library through `components/ui/chart`, and raw `<img>` remains only in generated print HTML/string templates.
- Step 8 first pass is complete for refactor guard tests. Static guards now protect the removed `chart.js` dependency, raw print-template image exceptions, and Step 6 UI cleanup rules.
- Sales list helper first pass is complete. Pure bill, item, status, date-option, pagination, and invoice-print data helpers moved into `sales-list-utils.ts` with focused tests, while page workflow/store/print behavior stays unchanged.
- Sales list UI/component split first pass is complete. `sales-list-page.tsx` remains the state/effects/store/print composition root, while controls, cards, bill detail, cancel dialog, and status badge UI now live in focused sales list modules.
- POS cart panel first pass is complete. `SelectedTableCartPanel` is now a small composition root backed by a cart-panel workflow hook, a customer-display workflow hook, and a focused content component, while payment dialog behavior and props stay unchanged.
- POS payment dialog first pass is complete. `PaymentDialog` is now a small composition root backed by a payment workflow hook and a focused content component, while payment payloads, split payment, customer search, keypad/caret behavior, receipt print, invoice print, and fallback print behavior stay unchanged.
- Public POS browse shell first pass is complete. `ProductBrowse` is now a small composition root backed by a public browse workflow hook and a focused content component, while search, lazy menu rendering, category tabs, QR dialog, product add, cart sheet, and fly-to-cart behavior stay unchanged.
- Public POS product order sheet first pass is complete. `ProductOrderSheet` is now a small composition root backed by a product-order workflow hook and a focused content component, while product modes, detail/topping selection, quantity guards, notes, add payloads, and fly-to-cart source rect behavior stay unchanged.
- Public POS cart sheet first pass is complete. `CartSheet` is now a small composition root backed by a cart-sheet workflow hook and focused content/item modules, while cart grouping, qty changes, deletion, confirm kitchen, receipt totals, media rendering, and loading/empty states stay unchanged.
- Public POS menu sections first pass is complete. `public-menu-sections.tsx` now preserves its existing exports while rail sections, category sections, product cards, and product media live in focused modules with the same lazy-load, reveal, click, image-priority, and blocked-state behavior.
- Public POS menu browse hook first pass is complete. `use-public-menu-browse.ts` now delegates derived menu model data and safe category loading to focused hooks while keeping search/menu load, category tab navigation, sentinel reveal, and scroll behavior unchanged.
- Public POS cart/order actions first pass is complete. `use-public-cart-order-actions.ts` now composes focused add-to-cart, product-click, and cart-maintenance action hooks while keeping product modal/direct-add, cart hydration, qty/delete, confirm kitchen, toasts, and fly-to-cart behavior unchanged.
- Final consistency pass is complete. The completed refactor areas were audited for UI rule regressions, raw image policy, removed `chart.js`, dialog/sheet title coverage, and direct service workflow imports; no broad follow-up split was needed.
- Build verification is intentionally not recorded here because the user handles `npm run build` manually.

## Do Not Touch Unless Needed

- Short App Router page wrappers that only parse params and render feature pages.
- shadcn/ui primitives in `src/components/ui`, unless updating them through the shadcn CLI or fixing a real issue.
- Existing pure utility tests that already cover behavior well.
- Working behavior for URL pagination, translations, dark mode, protected app shell breadcrumbs, POS print flows, payment flows, and public POS ordering.

## Deferred, Not Because Broken

- Remaining large files are not automatic refactor targets. Size alone is not enough reason to split them.
- Large modules such as report table/component files, POS utility/item surfaces, public POS/order helpers, exchange/customer settings, printer pages, and permission pages are deferred unless a concrete rule violation, behavior risk, or maintenance problem appears.
- Allowed helper imports such as URL builders, report constants/type guards, and print-job helpers can remain where they do not create service-backed UI workflows.

## Step 1: Freeze Inventory And Safety Net

Before each refactor phase, run:

```bash
npm run typecheck
npm test
npm run lint
git status --short
```

Actions:

- Record the exact target domain for the phase.
- Identify files over roughly `500` lines in that domain.
- List direct service imports from feature UI or workflow files.
- Identify existing tests that protect the domain.
- Add missing pure utility tests before moving behavior if the domain has risky calculations, normalization, filtering, totals, payment math, or payload building.

Acceptance criteria:

- The implementer knows which domain is being refactored.
- Baseline commands pass before changes.
- Unrelated dirty files are ignored and never reverted.

## Step 2: Clarify Service, Store, And Feature Boundaries

Target outcome:

- `services` contain API request functions, endpoint helpers, payload validators, and API-facing types.
- `stores` own service-backed workflows, loading state, error state, cached rows, mutations, and refresh behavior.
- `features` own UI, event handling, local form state, derived view models, and calls to store actions.
- `lib` contains shared framework-agnostic helpers.
- `hooks` contains reusable client hooks that are not tied to one feature domain.

Actions:

- Move behavior-like direct service calls from feature pages/hooks into the matching store action.
- Keep type-only service imports where they are still the clearest source of domain types.
- For repeated CRUD behavior, reuse or improve existing generic CRUD store patterns instead of adding one-off state machines.
- Keep service request functions small and explicit.
- Completed: report export loading moved into report store actions for daily sales, best-selling products, and payment methods.
- Remaining candidates: POS order-customer service calls and settings config service binding.
- Treat settings config cleanup primarily as Step 4 work unless it blocks a boundary change.

Acceptance criteria:

- Feature components no longer call API services directly for save, delete, fetch, or report load workflows when a store is appropriate.
- Store actions are named around user intent, such as `loadReports`, `saveProduct`, `removeCategory`, or `refreshCart`.
- Typecheck, tests, and lint pass after the domain boundary change.

## Step 3: Split Large Feature Files By Responsibility

Start with the largest and highest-risk files, one workflow at a time:

- `src/features/sales/list/sales-list-page.tsx`
- POS table selection cart and payment files
- `src/features/product/list/product-page.tsx`
- `src/features/product/form/use-product-form-workflow.ts`
- `src/features/dashboard/overview/components/dashboard-widgets.tsx`
- settings pages with repeated CRUD UI patterns

Completed in this step:

- Product list first pass: `src/features/product/list/product-page.tsx` is now a smaller composition root backed by focused product list modules.
- Product form first pass: `src/features/product/form/use-product-form-workflow.ts` now composes smaller hooks for reference data, image payload/preview, detail rows, set options, and toppings.
- POS cart panel first pass: `src/features/pos/table-selection/selected-table-cart-panel.tsx` is now a smaller composition root backed by focused workflow/content modules.
- POS payment dialog first pass: `src/features/pos/table-selection/payment-dialog.tsx` is now a smaller composition root backed by focused workflow/content modules.
- Public POS browse shell first pass: `src/features/public-pos/order/components/product-browse.tsx` is now a smaller composition root backed by focused workflow/content modules.
- Public POS product order sheet first pass: `src/features/public-pos/order/components/product-order-sheet.tsx` is now a smaller composition root backed by focused workflow/content modules.
- Public POS cart sheet first pass: `src/features/public-pos/order/components/cart-sheet.tsx` is now a smaller composition root backed by focused workflow/content/item modules.
- Public POS menu sections first pass: `src/features/public-pos/order/components/public-menu-sections.tsx` now re-exports focused rail, category, card, and media modules.
- Public POS menu browse hook first pass: `src/features/public-pos/order/hooks/use-public-menu-browse.ts` now composes focused menu model and category loader hooks.
- Public POS cart/order actions first pass: `src/features/public-pos/order/hooks/use-public-cart-order-actions.ts` now composes focused add-to-cart, product-click, and cart-maintenance hooks.
- Sales list UI/component split first pass: `src/features/sales/list/sales-list-page.tsx` now stays focused on state, effects, store actions, cancel flow, and receipt reprint flow, with controls, cards, detail, cancel dialog, and status badge UI split into focused modules.

Remaining Step 3 candidates:

- Additional POS table-selection files only where readability remains poor after the cart panel pass.
- Public POS deeper actions only where readability remains poor after the browse shell, section/sheet splits, menu browse hook pass, and cart/order actions pass.
- Additional settings or report pages only where a file is still hard to maintain.
- Dashboard widgets only if a future pass finds more readability issues after the Step 5 chart split.

Recommended split pattern:

- Keep the main `*-page.tsx` as the composition root.
- Move pure calculations to `*-utils.ts`.
- Move UI sections to small named components.
- Move workflow state and side effects to `use-*-workflow.ts` only when the workflow is truly shared or large.
- Move table columns, filters, dialogs, and export surfaces into focused files when they can be tested or read independently.

Acceptance criteria:

- No behavior change.
- Main page files become easy to scan from top to bottom.
- Extracted files have one clear responsibility.
- Existing tests still pass, and new utility tests cover moved logic where useful.

## Step 4: Make Settings CRUD Easier To Understand

Current settings code already has shared config and shared pages. Refactor it carefully instead of replacing it.

Actions:

- Separate settings metadata from service-bound actions where it improves readability.
- Keep display metadata in config: labels, columns, field definitions, route slugs, descriptions, and ID keys.
- Move service-backed loading, saving, deleting, and scoping behavior into stores or domain adapters.
- Consolidate repeated table, form, dialog, empty state, skeleton, and pagination behavior through existing shared settings components.
- Preserve specialized settings pages for cases that really need custom UI, such as store/branch, location, table, user, and category icon workflows.
- Completed first pass: `settings-config.ts` is metadata-only, and `useSettingsStore` resolves service actions through settings store adapters.
- Completed first pass: store/branch settings now keeps page-level store workflow in `store-branch-settings-page.tsx`, with labels, list/table/mobile UI, and form dialog UI split into focused modules.
- Completed first pass: location settings now keeps province/district store workflow, URL pagination, search, selection, grouping, collapse state, save/delete, and toasts in `location-settings-page.tsx`, with list, form dialog, and province combobox UI split into focused modules.
- Completed first pass: table settings now keeps branch/zone loading, table store workflow, URL pagination, search/order/limit, selection, zone collapse state, save/delete, and toasts in `table-page.tsx`, with grouped list, form dialog, and shared display UI split into focused modules.
- Completed first pass: user settings now keeps user store workflow, role loading, URL pagination, search/order/limit, selection, protected-user guards, image crop submit orchestration, save/delete, and toasts in `user-page.tsx`, with pure helpers, display UI, list UI, and form dialog UI split into focused modules.
- Completed first pass: currency settings now keeps currency store workflow, URL pagination, search/order/limit, selection, save/delete, and toasts in `currency-page.tsx`, with display UI, list UI, form dialog UI, and flag picker UI split into focused modules.
- Completed first pass: category settings now keeps category store workflow, group option loading, URL pagination, search/order/limit, selection, drag-sort persistence, save/delete, and toasts in `category-page.tsx`, with display UI, list UI, and form dialog UI split into focused modules.
- Remaining candidates: simplify other specialized settings pages only where readability is still poor, and avoid touching generic option pages unless a real workflow issue appears.

Acceptance criteria:

- A new settings entity can be understood by reading one small metadata object and one store/domain action path.
- Generic CRUD entities use the shared path.
- Custom entities remain custom only where the product behavior requires it.

## Step 5: Improve Performance Without Changing Behavior

Actions:

- Reduce broad Client Component boundaries where a server wrapper can pass initial params or static copy.
- Parallelize independent async work with `Promise.all`.
- Start requests early and await late in route handlers or store workflows where it is safe.
- Avoid passing large duplicated objects from server components into client components.
- Extract expensive derived values into pure utility functions and memoize only when the computation is actually expensive.
- Use `next/dynamic` for heavy UI surfaces that are not needed on first paint, such as export previews, chart-heavy sections, or complex dialogs.
- Use `next/image` for visible app images where possible. Keep raw `<img>` only inside generated print HTML or string templates where React components cannot be used.
- Completed first pass: protected dashboard chart grids were moved to `src/features/dashboard/overview/components/dashboard-chart-widgets.tsx` and loaded dynamically from `dashboard-page.tsx`.
- Completed first pass: `dashboard-widgets.tsx` no longer imports Recharts or the shared chart wrapper, and stable skeleton fallbacks reserve the chart grid layout while the dynamic chunk loads.
- Completed first pass: `createDashboardModel` caches dashboard fallback row sources for payment, channel, product, trend, payment trend, and accounting rows.

Acceptance criteria:

- First render remains stable.
- No hydration warnings are introduced.
- Heavy dialogs or report/export surfaces do not load earlier than needed.
- Typecheck, tests, and lint pass.

## Step 6: Align UI With shadcn/ui Patterns

Actions:

- Before creating or changing UI, check existing shadcn components and use the local shadcn workflow.
- Use `Field`, `Input`, `Textarea`, `Select`, and `Checkbox` for forms.
- Use `Table`, `DropdownMenu`, `Dialog`, `AlertDialog`, `Alert`, `Empty`, `Skeleton`, and `Spinner` for common states.
- Use `AlertDialog` instead of `window.confirm` for destructive actions.
- Use `gap-*` with flex/grid instead of `space-x-*` and `space-y-*` in app UI.
- Use semantic tokens such as `bg-background`, `text-muted-foreground`, `border-border`, and component variants instead of raw color styling.
- Preserve dark mode when changing light mode colors or layout.
- Completed first pass: product toppings uses `gap-*` for its option list and lets icon buttons inherit shadcn button icon sizing.
- Completed first pass: POS payment-dialog loading fallback uses shadcn `Spinner`/`Skeleton`, and POS cart header spacing uses `gap-*`.
- Completed first pass: public POS loading progress uses the shadcn `Progress` primitive instead of custom pulsing markup.

Acceptance criteria:

- UI remains visually aligned with shadcn/ui `new-york`.
- Loading states use skeletons for page/content loading, not spinner-only screens.
- Dialogs and sheets include accessible titles.
- No visible regressions in mobile or desktop layouts.

## Step 7: Reduce Dependency And Asset Noise

Actions:

- Check whether `chart.js` is still used. If not, remove it after confirming reports/dashboard use Recharts through `components/ui/chart`.
- Keep Recharts for dashboard and report charts.
- Avoid custom chart SVG unless there is a clear product reason.
- Review image helpers and visible `<img>` usage. Prefer `next/image` for app-rendered images.
- Keep print-window HTML image tags only where they are required by the print implementation.
- Completed first pass: `chart.js` was removed after search confirmed no source usage.
- Completed first pass: Recharts remains for dashboard/report charts through the shared chart wrapper.
- Completed first pass: raw `<img>` usage was confirmed as print-template-only and left unchanged.
- Completed first pass: the dashboard hero sparkline remains a lightweight SVG exception so it does not pull Recharts back into the lightweight dashboard widget bundle.

Acceptance criteria:

- Unused dependencies are removed only after search confirms they are unused.
- Bundle size does not grow from refactor work.
- Charts stay consistent with the shared chart wrapper.

## Step 8: Expand Tests Around Refactored Behavior

Test priority:

1. Pure utilities and normalizers.
2. Store helpers and action state transitions.
3. Workflow hooks with complex branching.
4. Smoke tests or manual browser checks for large UI pages.

Required checks after each domain:

```bash
npm run typecheck
npm test
npm run lint
```

Manual UI checks for UI-heavy phases:

- Dashboard overview.
- Settings CRUD list, create, edit, delete, search, pagination.
- Product list and product form.
- POS table selection, cart, payment, invoice print path.
- Public POS browse, cart, QR dialog, and order flow.
- Sales list and cancel history.

Acceptance criteria:

- Tests cover moved logic before or during extraction.
- Full suite passes after each phase.
- Manual checks confirm no visible workflow regressions.
- Completed first pass: `src/lib/project-refactor-guards.test.ts` protects dependency, raw image, and UI cleanup decisions from Steps 6 and 7.
- Completed first pass: existing dashboard chart boundary tests remain the owner for Step 5 Recharts bundle guards.

## Suggested Refactor Order

1. Settings shared CRUD and repeated settings pages. First pass complete.
2. Report service/store boundary for export workflows. Complete.
3. Product list and product form workflow. First pass complete.
4. Settings config/store boundary. First pass complete.
5. Dashboard performance first pass. Complete.
6. shadcn/UI pattern cleanup first pass. Complete.
7. Dependency cleanup first pass. Complete.
8. Refactor guard tests first pass. Complete.
9. Sales list helper/test first pass. Complete.
10. POS table selection cart panel first pass. Complete.
11. POS payment dialog first pass. Complete.
12. Public POS browse shell first pass. Complete.
13. Public POS product order sheet first pass. Complete.
14. Public POS cart sheet first pass. Complete.
15. Public POS menu sections first pass. Complete.
16. Public POS menu browse hook first pass. Complete.
17. Public POS cart/order actions first pass. Complete.
18. Sales list UI/component split first pass. Complete.
19. Store/branch specialized settings split first pass. Complete.
20. Location specialized settings split first pass. Complete.
21. Table specialized settings split first pass. Complete.
22. User specialized settings split first pass. Complete.
23. Currency specialized settings split first pass. Complete.
24. Category specialized settings split first pass. Complete.
25. Final consistency pass. Complete.

This order starts with reusable CRUD patterns and report boundary cleanup, then moves through product, dashboard performance, targeted UI consistency, dependency cleanup, guard tests, sales-list safety extraction and UI split, POS cart/payment flow, the Public POS browse/product order/cart/menu section/menu browse/action hook splits, and the store/branch, location, table, user, currency, and category specialized settings splits. The final consistency pass intentionally stops further splitting unless a concrete issue appears.

## Final Definition Of Done

- Large files are split into focused, readable modules.
- Service-backed workflows are called through store actions.
- UI uses shadcn/ui primitives and project wrappers consistently.
- Tests cover important extracted logic.
- `npm run typecheck`, `npm test`, and `npm run lint` pass.
- Behavior remains unchanged unless a product change was explicitly approved.
