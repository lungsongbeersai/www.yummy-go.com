# React 19 Group A Hook Refactor Plan

> Execute with `superpowers:subagent-driven-development`. Use a fresh implementer and independent review for each task.

**Goal:** Remove the 19 currently confirmed React hook lint errors in the three requested workflow files without changing request timing, form hydration, cart state, category scrolling, backend payloads, or user-visible behavior.

**Source of truth:** `npx eslint` on the three files currently reports 19 errors: public menu 7, order customer 6, product form 6. The read-only control-flow analysis is stored at `.superpowers/sdd/react19-group-a-analysis.md`.

**Safety rule:** A lint error is not permission to rewrite a production lifecycle. Mechanical fixes land first. Effect rewrites require mounted-hook characterization that fails before implementation and passes afterward. If the current behavior cannot be preserved under the no-suppression constraint, record the item as unfixable and leave the effect unchanged.

**Protected Group B:** Do not modify `use-selected-table-cart`, `cancel-sale-page`, `use-public-pos-bootstrap`, `use-public-category-scroll`, `product-browse-content`, the storage subscription module, or DOM scroll orchestration owned outside the three Group A files.

---

## Task 1: Stabilize order workflow memoization on the primitive branch UUID

**Files:**

- Modify: `src/features/pos/order-customer/use-order-customer-workflow.ts`
- Verify: `src/features/pos/order-customer/order-customer-utils.test.ts`

### RED

Run the focused lint command and record the three `react-hooks/preserve-manual-memoization` failures in `fetchMenuGroups`, `loadTablesForBranch`, and `loadMenu`:

```powershell
npx eslint src/features/pos/order-customer/use-order-customer-workflow.ts
```

The file currently has six errors: three memoization errors in scope and three effect errors explicitly out of scope for this task.

### GREEN

1. Derive one primitive immediately after the auth-store selection:

   ```ts
   const branchUuid = user?.branch_uuid ?? "";
   ```

2. Use `branchUuid` in the bodies and dependency lists of only `fetchMenuGroups`, `loadTablesForBranch`, and `loadMenu`.
3. Preserve the empty-branch early returns, request payload keys, sorting, language, category selection, toasts, and state commit order exactly.
4. Do not change the three effects, `submitProductOrder`, services, stores, or public hook return shape.

### Verification

```powershell
npx eslint src/features/pos/order-customer/use-order-customer-workflow.ts
npx vitest run src/features/pos/order-customer/order-customer-utils.test.ts
npm run typecheck
git diff --check
```

Expected focused lint result: only the three pre-existing `set-state-in-effect` findings remain.

### Commit

```powershell
git add src/features/pos/order-customer/use-order-customer-workflow.ts
git commit -m "refactor(pos): stabilize order workflow dependencies"
```

---

## Task 2: Clarify public menu ref ownership without changing scroll timing

**Files:**

- Modify: `src/features/public-pos/order/hooks/use-public-menu-browse.ts`
- Verify: `src/features/public-pos/order/utils.test.ts`

### RED

Run focused lint and record four `react-hooks/immutability` findings plus three protected lifecycle-effect findings:

```powershell
npx eslint src/features/public-pos/order/hooks/use-public-menu-browse.ts
```

### GREEN

1. Alias only the two refs returned by the protected scroll hook:
   - `categoryRefs: categoryRefsRef`
   - `suppressScrollActiveUntil: suppressScrollActiveUntilRef`
2. Replace only local reads/writes with those aliases.
3. Preserve ref identity, `.current` write order, timers, scroll calls, category path calculation, request-key resets, and all three effects exactly.
4. Do not modify `use-public-category-scroll.ts` or any Group B file.

### Verification

```powershell
npx eslint src/features/public-pos/order/hooks/use-public-menu-browse.ts
npx vitest run src/features/public-pos/order/utils.test.ts
npm run typecheck
git diff --check
```

Expected focused lint result: only the three pre-existing `set-state-in-effect` findings remain.

### Commit

```powershell
git add src/features/public-pos/order/hooks/use-public-menu-browse.ts
git commit -m "refactor(public-pos): clarify menu browse refs"
```

---

## Task 3: Establish mounted-hook characterization for the remaining effects

**Files:**

- Inspect: `package.json`
- Inspect/Modify only if required: `vitest.config.ts`, `package.json`, `package-lock.json`
- Create: focused `.test.ts` hook tests beside the three Group A workflows

### Dependency gate

1. Check whether a maintained DOM hook harness is already installed.
2. Reuse it if present. If absent, add only `@testing-library/react` and `jsdom` as dev dependencies; do not introduce another state manager, UI kit, or test framework.
3. Keep the default test environment as Node. Opt only the mounted-hook files into jsdom.
4. Prove the harness with one minimal RED/GREEN lifecycle test before adding production refactors.

### Required characterization

**Order customer:**

- route table changes synchronize the selected table and close the cart sheet;
- initial menu loading occurs once for a valid branch and not for an empty branch;
- printer context clears on logout and stale async resolution cannot restore it.

**Public menu:**

- category-order changes reset refs and presentation state as one observable transition;
- request-key changes clear rail/collapse/jump state;
- a loaded pending category schedules exactly one scroll without erasing the target early.

**Product form:**

- a partial edit row triggers one fallback load per `${prodUuid}:${language}:${branchUuid}` key and create mode permits a later edit load;
- hydration applies the complete field transaction, preserves user edits after full hydration, and permits partial-to-full hydration;
- editable category/unit values outrank stored defaults, defaults fill only empty create fields, and late reference updates never overwrite user choices;
- saved color-image state forces image mode `"2"` and keeps file/crop clearing behavior.

### Verification

```powershell
npx vitest run src/features/pos/order-customer/use-order-customer-workflow.test.ts src/features/public-pos/order/hooks/use-public-menu-browse.test.ts src/features/product/form/use-product-form-workflow.test.ts --maxWorkers=1
npm run typecheck
npx eslint src/features/pos/order-customer/use-order-customer-workflow.test.ts src/features/public-pos/order/hooks/use-public-menu-browse.test.ts src/features/product/form/use-product-form-workflow.test.ts
git diff --check
```

### Commit

```powershell
git add package.json package-lock.json vitest.config.ts src/features/pos/order-customer/use-order-customer-workflow.test.ts src/features/public-pos/order/hooks/use-public-menu-browse.test.ts src/features/product/form/use-product-form-workflow.test.ts
git commit -m "test(react): characterize Group A hook lifecycles"
```

Omit unchanged manifest/config files from staging.

---

## Task 4: Refactor characterized order and public-menu effects one invariant at a time

**Files:**

- Modify: `src/features/pos/order-customer/use-order-customer-workflow.ts`
- Modify: `src/features/public-pos/order/hooks/use-public-menu-browse.ts`
- Modify: their new mounted-hook tests

For each effect finding, add or tighten one failing assertion first. Prefer event-owned actions, primitive dependencies, or a keyed render reset only when the characterization proves identical observable ordering. Do not use `setTimeout`, `queueMicrotask`, suppressions, or edits to protected scroll ownership as lint workarounds.

After each individual change, rerun the owning hook test and focused ESLint. If an invariant cannot be preserved, revert that individual change and record the finding as unfixable.

```powershell
npx eslint src/features/pos/order-customer/use-order-customer-workflow.ts src/features/public-pos/order/hooks/use-public-menu-browse.ts
npx vitest run src/features/pos/order-customer/use-order-customer-workflow.test.ts src/features/public-pos/order/hooks/use-public-menu-browse.test.ts --maxWorkers=1
npm run typecheck
git diff --check
```

Commit only the proven subset:

```powershell
git commit -m "refactor(react): preserve order and menu lifecycles"
```

---

## Task 5: Refactor product-form hydration only behind characterization

**Files:**

- Modify: `src/features/product/form/use-product-form-workflow.ts`
- Modify: its new mounted-hook test

Treat `editLoadKey`, the multi-field hydration transaction, and late reference/default selection as three separate TDD cycles. A state-to-ref change is not mechanical because it changes rerender timing. A keyed render reset is permitted only if tests prove partial rows, full rows, user edits, image mode, and default precedence remain identical.

```powershell
npx eslint src/features/product/form/use-product-form-workflow.ts
npx vitest run src/features/product/form/product-form-utils.test.ts src/features/product/form/use-product-form-workflow.test.ts --maxWorkers=1
npm run typecheck
git diff --check
```

If every invariant remains green, commit:

```powershell
git commit -m "refactor(product): preserve form hydration lifecycle"
```

If not, revert only the failing technique, keep the characterized tests, and document the remaining lint item as intentionally unresolved without suppression.

---

## Final Group A gate

```powershell
npx eslint src/features/public-pos/order/hooks/use-public-menu-browse.ts src/features/pos/order-customer/use-order-customer-workflow.ts src/features/product/form/use-product-form-workflow.ts
npx vitest run --maxWorkers=1
npm run typecheck
npm run build
```

Report exact remaining Group A and protected Group B counts separately. Never report project-wide React hook lint as fixed by excluding files or adding suppressions.
