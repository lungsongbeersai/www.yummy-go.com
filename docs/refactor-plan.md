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

Baseline commands passed before writing this plan:

```bash
npm run typecheck
npm test
npm run lint
```

Observed baseline:

- `npm run typecheck` passed.
- `npm test` passed with `37` test files and `190` tests.
- `npm run lint` passed.
- Most route files in `src/app` are already short wrappers around feature pages.
- The project already has useful domain folders under `src/features`, `src/stores`, and `src/services`.
- The largest maintenance pressure is concentrated in large feature pages, workflow hooks, report/dashboard components, POS flows, and settings CRUD.

## Do Not Touch Unless Needed

- Short App Router page wrappers that only parse params and render feature pages.
- shadcn/ui primitives in `src/components/ui`, unless updating them through the shadcn CLI or fixing a real issue.
- Existing pure utility tests that already cover behavior well.
- Working behavior for URL pagination, translations, dark mode, protected app shell breadcrumbs, POS print flows, payment flows, and public POS ordering.

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

## Suggested Refactor Order

1. Settings shared CRUD and repeated settings pages.
2. Product list and product form workflow.
3. Sales list and cancel history.
4. POS table selection cart and payment.
5. Public POS browse and order flow.
6. Dashboard and report components.
7. Dependency cleanup and final consistency pass.

This order starts with reusable CRUD patterns, then moves through product and sales workflows before touching the highest-risk POS flows.

## Final Definition Of Done

- Large files are split into focused, readable modules.
- Service-backed workflows are called through store actions.
- UI uses shadcn/ui primitives and project wrappers consistently.
- Tests cover important extracted logic.
- `npm run typecheck`, `npm test`, and `npm run lint` pass.
- Behavior remains unchanged unless a product change was explicitly approved.
