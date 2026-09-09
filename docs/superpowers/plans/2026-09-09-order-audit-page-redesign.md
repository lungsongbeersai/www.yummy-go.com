# Order Audit Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/report/order-audit` (`src/features/report/order-audit/order-audit-page.tsx`) as a compact toolbar + scannable, severity-colored table (card list on mobile) with a slide-over detail panel, per the approved spec at `docs/superpowers/specs/2026-09-09-order-audit-page-redesign-design.md`.

**Architecture:** Split the current 166-line single-file page into focused presentational components (toolbar, filter sheet, table, mobile card list, detail sheet, action badge, skeleton) composed by a slimmer `order-audit-page.tsx`. All existing state, validation, and data-fetching logic in the page and in `src/stores/report-store/order-audit.ts` / `src/services/report/order-audit.ts` is reused unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 semantic tokens, shadcn/ui (`Sheet`, `Table`, `Card`, `Badge`, `Input`, `Button`, `Skeleton`), react-i18next, Vitest 4.

## Global Constraints

- Never use `any` (CLAUDE.md Non-negotiable 1).
- No raw palette colors, arbitrary fonts, or new global CSS — use `bg-warning`, `text-destructive`, etc. from `globals.css` only (Non-negotiable 8, `docs/Design.md`).
- Components call store actions, never services directly — this plan does not add any new service/store calls, it only restructures presentation (Non-negotiable 4).
- Any new i18n key must exist in both `public/locales/en/common.json` and `public/locales/la/common.json`, or `src/lib/i18n-resources.test.ts` fails.
- Tests cover pure logic only (`docs/Testing.md`, `docs/Design.md`) — no component/UI tests are added; verification of UI is manual in the browser.
- `npm run typecheck` and `npm run lint` must stay clean; run both before considering any task done.
- Follow the component decision order in `docs/Design.md`: reuse `src/components/ui/*` primitives and the existing `report-filter-fields.tsx` fields before writing new markup.

---

### Task 1: Add the `orderAudit.filters` i18n key

**Files:**
- Modify: `public/locales/en/common.json` (inside the `orderAudit` object, alphabetically near `field`/`entity`)
- Modify: `public/locales/la/common.json` (same key, same position)
- Test: `src/lib/i18n-resources.test.ts` (existing test, no changes — just must keep passing)

**Interfaces:**
- Produces: translation key `orderAudit.filters`, consumed by Task 6 (`order-audit-toolbar.tsx`) and Task 5 (`order-audit-filter-sheet.tsx`).

- [ ] **Step 1: Add the key to the English locale**

In `public/locales/en/common.json`, inside the `"orderAudit": { ... }` block, add:

```json
    "entity": "Record",
    "filters": "Filters",
    "all": "All",
```

(insert the `"filters"` line right after the existing `"entity"` line, before `"all"`)

- [ ] **Step 2: Add the matching key to the Lao locale**

In `public/locales/la/common.json`, inside the same `"orderAudit": { ... }` block, add:

```json
    "entity": "ປະເພດຂໍ້ມູນ",
    "filters": "ໂຕກອງ",
    "all": "ທັງໝົດ",
```

- [ ] **Step 3: Run the i18n parity test**

Run: `npm test -- src/lib/i18n-resources.test.ts`
Expected: PASS (the test asserts every `en` key has a matching `la` key and vice versa; both files now carry `orderAudit.filters`).

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/common.json public/locales/la/common.json
git commit -m "$(cat <<'EOF'
Add orderAudit.filters i18n key for the redesigned filter sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add the `activeAuditFilterCount` pure helper

**Files:**
- Modify: `src/features/report/order-audit/order-audit-utils.ts`
- Test: `src/features/report/order-audit/order-audit-utils.test.ts`

**Interfaces:**
- Produces: `activeAuditFilterCount(filters: { dateFrom: string; dateTo: string; action: string; entity: string }, today: string): number` — consumed by Task 10 (`order-audit-page.tsx`) to drive the toolbar's filter-count badge (Task 6).

- [ ] **Step 1: Write the failing test**

Add to `src/features/report/order-audit/order-audit-utils.test.ts` (new `it` inside the existing `describe` block, alongside the other imports add `activeAuditFilterCount` to the import line at the top):

```ts
import { activeAuditFilterCount, auditChanges, auditDateTime, auditToday, auditValue, validAuditDateRange } from "./order-audit-utils";
```

```ts
  it("counts only non-default filters, not the always-required branch/date fields", () => {
    const today = "2026-09-09";
    expect(activeAuditFilterCount({ dateFrom: today, dateTo: today, action: "all", entity: "all" }, today)).toBe(0);
    expect(activeAuditFilterCount({ dateFrom: "2026-09-01", dateTo: today, action: "all", entity: "all" }, today)).toBe(1);
    expect(activeAuditFilterCount({ dateFrom: today, dateTo: today, action: "CANCEL", entity: "all" }, today)).toBe(1);
    expect(activeAuditFilterCount({ dateFrom: today, dateTo: today, action: "all", entity: "ITEM" }, today)).toBe(1);
    expect(activeAuditFilterCount({ dateFrom: "2026-09-01", dateTo: "2026-09-05", action: "CANCEL", entity: "ITEM" }, today)).toBe(3);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/report/order-audit/order-audit-utils.test.ts`
Expected: FAIL with `activeAuditFilterCount is not a function` (or a TypeScript import error).

- [ ] **Step 3: Implement the helper**

In `src/features/report/order-audit/order-audit-utils.ts`, add (near the other exported functions, after `validAuditDateRange`):

```ts
export function activeAuditFilterCount(
  filters: { dateFrom: string; dateTo: string; action: string; entity: string },
  today: string,
) {
  let count = 0;
  if (filters.dateFrom !== today || filters.dateTo !== today) count += 1;
  if (filters.action !== "all") count += 1;
  if (filters.entity !== "all") count += 1;
  return count;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/report/order-audit/order-audit-utils.test.ts`
Expected: PASS, all cases in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/features/report/order-audit/order-audit-utils.ts src/features/report/order-audit/order-audit-utils.test.ts
git commit -m "$(cat <<'EOF'
Add activeAuditFilterCount helper for the toolbar filter badge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create `order-audit-action-badge.tsx`

**Files:**
- Create: `src/features/report/order-audit/order-audit-action-badge.tsx`

**Interfaces:**
- Consumes: `OrderAuditAction` type from `@/services/report`; `Badge` from `@/components/ui/badge`; `cn` from `@/lib/utils`.
- Produces: `OrderAuditActionBadge({ action, label }: { action: OrderAuditAction; label: string })` — a React component consumed by Task 7 (`order-audit-table.tsx`) and Task 8 (`order-audit-row-card.tsx`).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderAuditAction } from "@/services/report";

const ACTION_BADGE_CLASSES: Record<OrderAuditAction, string> = {
  CREATE: "border-success/25 bg-success/10 text-success",
  UPDATE: "border-warning/25 bg-warning/10 text-warning",
  DELETE: "border-destructive/25 bg-destructive/10 text-destructive",
  DISCOUNT: "border-warning/25 bg-warning/10 text-warning",
  PRICE: "border-warning/25 bg-warning/10 text-warning",
  QUANTITY: "border-warning/25 bg-warning/10 text-warning",
  CANCEL: "border-destructive/25 bg-destructive/10 text-destructive",
  MOVE: "border-warning/25 bg-warning/10 text-warning",
  PAYMENT: "border-info/25 bg-info/10 text-info",
};

export function OrderAuditActionBadge({ action, label }: { action: OrderAuditAction; label: string }) {
  return (
    <Badge variant="outline" className={cn(ACTION_BADGE_CLASSES[action])}>
      {label}
    </Badge>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors (the file is not imported anywhere yet, but `tsc --noEmit` still type-checks it).

- [ ] **Step 3: Commit**

```bash
git add src/features/report/order-audit/order-audit-action-badge.tsx
git commit -m "$(cat <<'EOF'
Add severity-colored action badge for order audit rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Create `order-audit-skeleton.tsx`

**Files:**
- Create: `src/features/report/order-audit/order-audit-skeleton.tsx`

**Interfaces:**
- Consumes: `Skeleton` from `@/components/ui/skeleton`.
- Produces: `OrderAuditSkeleton()` — consumed by Task 10 (`order-audit-page.tsx`) in place of the current `<Skeleton className="h-64 w-full" />`.

- [ ] **Step 1: Write the component**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = 6;
const SKELETON_COLUMNS = 6;

export function OrderAuditSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card" aria-hidden="true">
      <div className="flex items-center gap-4 border-b p-3">
        {Array.from({ length: SKELETON_COLUMNS }, (_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-b p-3 last:border-b-0">
          {Array.from({ length: SKELETON_COLUMNS }, (_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/order-audit/order-audit-skeleton.tsx
git commit -m "$(cat <<'EOF'
Add table-shaped skeleton for order audit loading state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Create `order-audit-filter-sheet.tsx`

**Files:**
- Create: `src/features/report/order-audit/order-audit-filter-sheet.tsx`

**Interfaces:**
- Consumes: `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetFooter` from `@/components/ui/sheet`; `Button` from `@/components/ui/button`; `ReportBranchField`/`ReportDateRangeFields`/`ReportSelectField`, `ReportFieldOption` from `@/features/report/shared/report-filter-fields`.
- Produces: `OrderAuditFilterSheet` component and its `OrderAuditDraft` type export — consumed by Task 10 (`order-audit-page.tsx`).

```ts
export interface OrderAuditDraft {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  action: string;
  entity: string;
}
```

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReportBranchField, ReportDateRangeFields, ReportSelectField, type ReportFieldOption } from "@/features/report/shared/report-filter-fields";

export interface OrderAuditDraft {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  action: string;
  entity: string;
}

export function OrderAuditFilterSheet({
  open,
  onOpenChange,
  draft,
  draftBranch,
  onDraftChange,
  branchLoading,
  branchLocked,
  branchOptions,
  actionOptions,
  entityOptions,
  valid,
  dateRangeInvalid,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: OrderAuditDraft;
  draftBranch: string;
  onDraftChange: (updater: (previous: OrderAuditDraft) => OrderAuditDraft) => void;
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  actionOptions: ReportFieldOption[];
  entityOptions: ReportFieldOption[];
  valid: boolean;
  dateRangeInvalid: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{t("orderAudit.filters")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6">
          <ReportBranchField
            id="audit-branch"
            branchLoading={branchLoading}
            branchLocked={branchLocked}
            options={branchOptions}
            value={draftBranch}
            onValueChange={branchUuid => onDraftChange(previous => ({ ...previous, branchUuid }))}
          />
          <ReportDateRangeFields
            idPrefix="audit"
            dateFrom={draft.dateFrom}
            dateTo={draft.dateTo}
            onDateFromChange={dateFrom => onDraftChange(previous => ({ ...previous, dateFrom }))}
            onDateToChange={dateTo => onDraftChange(previous => ({ ...previous, dateTo }))}
          />
          <ReportSelectField
            id="audit-action"
            label={t("orderAudit.action")}
            value={draft.action}
            options={actionOptions}
            onValueChange={action => onDraftChange(previous => ({ ...previous, action }))}
          />
          <ReportSelectField
            id="audit-entity"
            label={t("orderAudit.entity")}
            value={draft.entity}
            options={entityOptions}
            onValueChange={entity => onDraftChange(previous => ({ ...previous, entity }))}
          />
          {dateRangeInvalid && (
            <p className="text-sm text-destructive" role="alert">{t("orderAudit.invalidDates")}</p>
          )}
        </div>
        <SheetFooter>
          <Button disabled={!valid} onClick={onApply}>{t("actions.search")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/order-audit/order-audit-filter-sheet.tsx
git commit -m "$(cat <<'EOF'
Add filter sheet for order audit branch/date/action/entity filters

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Create `order-audit-toolbar.tsx`

**Files:**
- Create: `src/features/report/order-audit/order-audit-toolbar.tsx`

**Interfaces:**
- Consumes: `Badge` from `@/components/ui/badge`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `RefreshCwIcon`, `SlidersHorizontalIcon` from `lucide-react`.
- Produces: `OrderAuditToolbar` component — consumed by Task 10 (`order-audit-page.tsx`).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OrderAuditToolbar({
  search,
  onSearchChange,
  onSubmit,
  filterCount,
  onOpenFilters,
  onRefresh,
  refreshDisabled,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onSubmit: () => void;
  filterCount: number;
  onOpenFilters: () => void;
  onRefresh: () => void;
  refreshDisabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={event => { event.preventDefault(); onSubmit(); }}
    >
      <Input
        value={search}
        maxLength={120}
        placeholder={t("orderAudit.search")}
        aria-label={t("orderAudit.search")}
        className="min-h-10 min-w-0 flex-1 basis-52"
        onChange={event => onSearchChange(event.target.value)}
      />
      <Button type="button" variant="outline" className="min-h-10 gap-2" onClick={onOpenFilters}>
        <SlidersHorizontalIcon className="size-4" />
        {t("orderAudit.filters")}
        {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="min-h-10 min-w-10"
        disabled={refreshDisabled}
        aria-label={t("actions.refresh")}
        onClick={onRefresh}
      >
        <RefreshCwIcon className="size-4" />
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/order-audit/order-audit-toolbar.tsx
git commit -m "$(cat <<'EOF'
Add compact search/filter/refresh toolbar for order audit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Create `order-audit-table.tsx`

**Files:**
- Create: `src/features/report/order-audit/order-audit-table.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`; `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` from `@/components/ui/table`; `OrderAuditRow` from `@/services/report`; `auditDateTime` from `./order-audit-utils`; `OrderAuditActionBadge` from `./order-audit-action-badge` (Task 3).
- Produces: `OrderAuditTable` component — consumed by Task 10 (`order-audit-page.tsx`). Visible only at `md` and up (`hidden md:block`); Task 8's card list is its `md:hidden` counterpart.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderAuditRow } from "@/services/report";
import { OrderAuditActionBadge } from "./order-audit-action-badge";
import { auditDateTime } from "./order-audit-utils";

const COLUMNS = ["time", "invoice", "actor", "action", "entity", "details"] as const;

export function OrderAuditTable({
  rows,
  language,
  onSelect,
}: {
  rows: OrderAuditRow[];
  language: string;
  onSelect: (auditId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="hidden shrink-0 overflow-hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map(key => <TableHead key={key}>{t(`orderAudit.${key}`)}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.audit_id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(row.audit_id)}>
              <TableCell className="tabular-nums">{auditDateTime(row.recorded_at, language)}</TableCell>
              <TableCell className="font-medium">
                {row.related_order_uuid_fk && (
                  <span className="text-muted-foreground">{row.related_order_invoice || row.related_order_uuid_fk} → </span>
                )}
                {row.order_invoice || row.order_uuid_fk}
              </TableCell>
              <TableCell>{row.actor_name || t(`orderAudit.actorTypes.${row.actor_type}`)}</TableCell>
              <TableCell><OrderAuditActionBadge action={row.action} label={t(`orderAudit.actions.${row.action}`)} /></TableCell>
              <TableCell>
                {t(`orderAudit.entities.${row.entity_type}`)}
                <p className="text-muted-foreground">
                  {language === "en" ? row.entity_label_eng || row.entity_label_la : row.entity_label_la || row.entity_label_eng}
                </p>
              </TableCell>
              <TableCell>
                <Button variant="outline" className="min-h-10" onClick={event => { event.stopPropagation(); onSelect(row.audit_id); }}>
                  {t("orderAudit.compare")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/order-audit/order-audit-table.tsx
git commit -m "$(cat <<'EOF'
Add desktop order audit table with severity badges and row click

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Create `order-audit-row-card.tsx`

**Files:**
- Create: `src/features/report/order-audit/order-audit-row-card.tsx`

**Interfaces:**
- Consumes: `Card` from `@/components/ui/card`; `OrderAuditRow` from `@/services/report`; `auditDateTime` from `./order-audit-utils`; `OrderAuditActionBadge` from `./order-audit-action-badge` (Task 3).
- Produces: `OrderAuditRowCard` component — consumed by Task 10 (`order-audit-page.tsx`). Visible only below `md` (`md:hidden`), the counterpart to Task 7's table.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { OrderAuditRow } from "@/services/report";
import { OrderAuditActionBadge } from "./order-audit-action-badge";
import { auditDateTime } from "./order-audit-utils";

export function OrderAuditRowCard({
  rows,
  language,
  onSelect,
}: {
  rows: OrderAuditRow[];
  language: string;
  onSelect: (auditId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {rows.map(row => (
        <Card
          key={row.audit_id}
          role="button"
          tabIndex={0}
          className="min-h-10 gap-2 px-4 py-3"
          onClick={() => onSelect(row.audit_id)}
          onKeyDown={event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSelect(row.audit_id);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="tabular-nums text-sm text-muted-foreground">{auditDateTime(row.recorded_at, language)}</span>
            <OrderAuditActionBadge action={row.action} label={t(`orderAudit.actions.${row.action}`)} />
          </div>
          <p className="font-medium">
            {row.related_order_uuid_fk && (
              <span className="text-muted-foreground">{row.related_order_invoice || row.related_order_uuid_fk} → </span>
            )}
            {row.order_invoice || row.order_uuid_fk}
          </p>
          <p className="text-sm">{row.actor_name || t(`orderAudit.actorTypes.${row.actor_type}`)}</p>
          <p className="text-sm text-muted-foreground">
            {t(`orderAudit.entities.${row.entity_type}`)} ·{" "}
            {language === "en" ? row.entity_label_eng || row.entity_label_la : row.entity_label_la || row.entity_label_eng}
          </p>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/order-audit/order-audit-row-card.tsx
git commit -m "$(cat <<'EOF'
Add mobile card list for order audit rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Create `order-audit-detail-sheet.tsx`

**Files:**
- Create: `src/features/report/order-audit/order-audit-detail-sheet.tsx`

**Interfaces:**
- Consumes: `Sheet`/`SheetContent`/`SheetDescription`/`SheetHeader`/`SheetTitle` from `@/components/ui/sheet`; `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` from `@/components/ui/table`; `OrderAuditRow` from `@/services/report`; `auditChanges`, `auditDateTime` from `./order-audit-utils`.
- Produces: `OrderAuditDetailSheet` component — consumed by Task 10 (`order-audit-page.tsx`), replacing the current `Dialog`.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderAuditRow } from "@/services/report";
import { auditChanges, auditDateTime } from "./order-audit-utils";

export function OrderAuditDetailSheet({
  row,
  language,
  branchLabel,
  onOpenChange,
}: {
  row: OrderAuditRow | null;
  language: string;
  branchLabel: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("orderAudit.compare")} · {row?.order_invoice || "—"}</SheetTitle>
          <SheetDescription>{t("orderAudit.compareNotice")}</SheetDescription>
        </SheetHeader>
        {row && (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <p className="font-medium">
              {branchLabel} · {t(`orderAudit.entities.${row.entity_type}`)} ·{" "}
              {language === "en" ? row.entity_label_eng || row.entity_label_la : row.entity_label_la || row.entity_label_eng}
            </p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{t("orderAudit.actor")}</dt><dd>{row.actor_name || t(`orderAudit.actorTypes.${row.actor_type}`)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.time")}</dt><dd>{auditDateTime(row.recorded_at, language)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.action")}</dt><dd>{t(`orderAudit.actions.${row.action}`)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.reason")}</dt><dd className="break-words whitespace-pre-wrap">{row.reason || t("orderAudit.notProvided")}</dd></div>
            </dl>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orderAudit.field")}</TableHead>
                  <TableHead>{t("orderAudit.before")}</TableHead>
                  <TableHead>{t("orderAudit.after")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditChanges(row, language, t).map(change => (
                  <TableRow key={change.field}>
                    <TableCell>{change.label}</TableCell>
                    <TableCell className="max-w-64 break-words whitespace-pre-wrap text-muted-foreground line-through decoration-muted-foreground/50">
                      {change.before}
                    </TableCell>
                    <TableCell className="max-w-64 break-words whitespace-pre-wrap font-medium text-foreground">
                      {change.after}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="break-all text-xs text-muted-foreground">{t("orderAudit.reference")}: {row.audit_id} · {row.entity_uuid}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/order-audit/order-audit-detail-sheet.tsx
git commit -m "$(cat <<'EOF'
Add detail sheet with struck-through before / emphasized after values

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Rewrite `order-audit-page.tsx` to compose the new pieces

**Files:**
- Modify: `src/features/report/order-audit/order-audit-page.tsx` (full rewrite of `OrderAuditReport`; `OrderAuditPage` wrapper is unchanged)

**Interfaces:**
- Consumes: `OrderAuditToolbar` (Task 6), `OrderAuditFilterSheet` + `OrderAuditDraft` (Task 5), `OrderAuditTable` (Task 7), `OrderAuditRowCard` (Task 8), `OrderAuditDetailSheet` (Task 9), `OrderAuditSkeleton` (Task 4), `activeAuditFilterCount` (Task 2), plus everything already imported today (`useOrderAuditReportStore`, `useReportBranchSelection`, `ORDER_AUDIT_ACTIONS`, `auditToday`, `validAuditDateRange`, `EmptyState`, `Alert`/`AlertDescription`).
- Produces: the page's rendered output at `/report/order-audit` — no other file imports from this one besides `src/app/(protected)/report/order-audit/page.tsx`, which is unchanged.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/features/report/order-audit/order-audit-page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ORDER_AUDIT_ACTIONS } from "@/config/order-audit";
import { OrderAuditDetailSheet } from "@/features/report/order-audit/order-audit-detail-sheet";
import { OrderAuditFilterSheet, type OrderAuditDraft } from "@/features/report/order-audit/order-audit-filter-sheet";
import { OrderAuditRowCard } from "@/features/report/order-audit/order-audit-row-card";
import { OrderAuditSkeleton } from "@/features/report/order-audit/order-audit-skeleton";
import { OrderAuditTable } from "@/features/report/order-audit/order-audit-table";
import { OrderAuditToolbar } from "@/features/report/order-audit/order-audit-toolbar";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useOrderAuditReportStore } from "@/stores/report-store";
import { activeAuditFilterCount, auditToday, validAuditDateRange } from "./order-audit-utils";

export function OrderAuditPage() {
  const user = useAuthStore(state => state.user);
  // Recreate filter/detail state when the authenticated store, branch or role changes.
  return <OrderAuditReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function OrderAuditReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useOrderAuditReportStore();
  const [draft, setDraft] = useState<OrderAuditDraft>(() => ({
    branchUuid: scope.defaultBranchUuid,
    dateFrom: auditToday(), dateTo: auditToday(), search: "", action: "all", entity: "all",
  }));
  const [applied, setApplied] = useState(draft);
  const [paging, setPaging] = useState({ page: 1, snapshot: "", refresh: 0, scope: scope.defaultBranchUuid });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = validAuditDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;

  useEffect(() => {
    if (!branchUuid) return;
    void load({ branch_uuid_fk: branchUuid, date_from: applied.dateFrom, date_to: applied.dateTo,
      search: applied.search, action: applied.action === "all" ? "" : applied.action,
      entity_type: applied.entity === "all" ? "" : applied.entity,
      page: paging.scope === branchUuid ? paging.page : 1, limit: 20,
      snapshot_id: paging.scope === branchUuid ? paging.snapshot || undefined : undefined,
      lang: language }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.dateFrom, applied.dateTo, applied.search,
    applied.action, applied.entity, paging.page, paging.snapshot, paging.refresh, paging.scope, language]);

  // Do not expose stale details from another scope while a replacement request starts.
  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo &&
    report.rows.every(row => row.store_uuid_fk === scope.storeUuid) ? report : null;
  const selected = current?.rows.find(row => row.audit_id === selectedId) ?? null;
  const actionOptions = [{ value: "all", label: t("orderAudit.all") },
    ...ORDER_AUDIT_ACTIONS.map(value => ({ value, label: t(`orderAudit.actions.${value}`) }))];
  const entityOptions = [{ value: "all", label: t("orderAudit.all") },
    ...["ORDER", "ITEM", "TOPPING", "PAYMENT"].map(value => ({ value, label: t(`orderAudit.entities.${value}`) }))];
  const filterCount = activeAuditFilterCount(applied, auditToday());

  function apply() {
    if (!valid) return;
    setSelectedId(null);
    setApplied({ ...draft, branchUuid: draftBranch });
    setPaging(previous => ({ page: 1, snapshot: "", refresh: previous.refresh + 1, scope: draftBranch }));
    setFilterSheetOpen(false);
  }

  function refresh() {
    setSelectedId(null);
    setPaging(previous => ({ ...previous, page: 1, snapshot: "", refresh: previous.refresh + 1, scope: branchUuid }));
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background font-lao">
      <header className="flex shrink-0 flex-col gap-2 border-b p-3 md:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">{t("orderAudit.title")}</h1>
          <p className="text-sm text-muted-foreground">{scope.branchLabelFor(branchUuid)}</p>
        </div>
        <OrderAuditToolbar
          search={draft.search}
          onSearchChange={search => setDraft(previous => ({ ...previous, search }))}
          onSubmit={apply}
          filterCount={filterCount}
          onOpenFilters={() => setFilterSheetOpen(true)}
          onRefresh={refresh}
          refreshDisabled={loading || !branchUuid}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
        <Alert><AlertDescription>{t("orderAudit.historyNotice")}</AlertDescription></Alert>
        {(error || scope.branchError) && <Alert variant="destructive"><AlertDescription>{error || scope.branchError}</AlertDescription></Alert>}
        {loading ? <OrderAuditSkeleton /> : current ? <>
          <p className="text-sm text-muted-foreground">{t("orderAudit.summary", current.summary)}</p>
          {current.rows.length ? <>
            <OrderAuditTable rows={current.rows} language={language} onSelect={setSelectedId} />
            <OrderAuditRowCard rows={current.rows} language={language} onSelect={setSelectedId} />
          </> : <EmptyState title={t("orderAudit.empty")} description={t("orderAudit.emptyDescription")} />}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm">{t("orderAudit.page", { page: current.pagination.page, total: current.pagination.total_pages })}</span>
            <Button variant="outline" disabled={current.pagination.page <= 1} onClick={() => {
              setSelectedId(null); setPaging(previous => ({ ...previous, page: current.pagination.page - 1, snapshot: current.pagination.snapshot_id, scope: branchUuid }));
            }}>{t("orderAudit.previous")}</Button>
            <Button variant="outline" disabled={current.pagination.page >= current.pagination.total_pages} onClick={() => {
              setSelectedId(null); setPaging(previous => ({ ...previous, page: current.pagination.page + 1, snapshot: current.pagination.snapshot_id, scope: branchUuid }));
            }}>{t("orderAudit.next")}</Button>
          </div>
        </> : null}
      </div>

      <OrderAuditFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        draft={draft}
        draftBranch={draftBranch}
        onDraftChange={setDraft}
        branchLoading={scope.branchLoading}
        branchLocked={!scope.canSelectBranch}
        branchOptions={scope.branchOptions}
        actionOptions={actionOptions}
        entityOptions={entityOptions}
        valid={valid}
        dateRangeInvalid={!dateRangeValid}
        onApply={apply}
      />

      <OrderAuditDetailSheet
        row={selected}
        language={language}
        branchLabel={scope.branchLabelFor(branchUuid)}
        onOpenChange={open => { if (!open) setSelectedId(null); }}
      />
    </section>
  );
}
```

- [ ] **Step 2: Run the full existing test suite for this feature**

Run: `npm test -- src/features/report/order-audit`
Expected: PASS (all `order-audit-utils.test.ts` cases, including the new one from Task 2).

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors (existing project ESLint config, e.g. no unused imports left over from the old `Dialog`/`Field`/`Input`/`Skeleton`/`Table`/`Badge` imports that are no longer used directly in this file).

- [ ] **Step 4: Commit**

```bash
git add src/features/report/order-audit/order-audit-page.tsx
git commit -m "$(cat <<'EOF'
Recompose order-audit page from toolbar, filter sheet, table/card, and detail sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Manual browser verification

**Files:** none (verification only)

**Interfaces:** none — this task confirms Tasks 1–10 work together in the running app.

- [ ] **Step 1: Start the dev server and open the page**

Run: `npm run dev`
Open `http://localhost:3000/report/order-audit` in the browser.

- [ ] **Step 2: Verify desktop behavior**

- Toolbar shows search input, "Filters" button (with a numeric badge once a non-default filter is applied), and refresh icon button.
- Typing in search and pressing Enter re-runs the query (network request fires with the new `search` param).
- Opening "Filters" shows the branch/date/action/entity fields in a right-side sheet; changing action/entity to a non-"all" value and clicking the apply button closes the sheet, updates the toolbar's filter-count badge, and refetches.
- Setting an invalid date range shows the inline error inside the sheet and disables the apply button.
- The table renders with colored action badges: CREATE green, CANCEL/DELETE red, DISCOUNT/PRICE/QUANTITY/MOVE/UPDATE amber, PAYMENT blue-ish (`info`).
- Clicking anywhere on a row (not just the "compare" button) opens the detail sheet on the right; the before/after table shows the before value struck through and the after value bold.
- Pagination previous/next buttons work and close the detail sheet if open.

- [ ] **Step 3: Verify mobile/tablet behavior**

Use the browser's device toolbar (or `resize_window` if using the Claude Browser pane) at a width below 768px (`md`):

- The table disappears and the card list appears instead, one card per row, each showing time, action badge, invoice, actor, and entity.
- Tapping a card opens the same detail sheet, now full-width.
- The toolbar wraps to remain usable at narrow widths; all buttons remain at least 40px tall (`min-h-10`).

- [ ] **Step 4: Verify empty, loading, and error states**

- Reload the page and confirm the table-shaped skeleton appears briefly instead of a single gray block.
- Pick a date range with no audit events (or a narrow future range) and confirm the `EmptyState` component renders.
- Temporarily disconnect network or pick a branch that errors (if reproducible) to confirm the destructive `Alert` still renders as before.

- [ ] **Step 5: Run the full verification suite**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm test`
Run: `npm run build`
Expected: all four pass, per CLAUDE.md's "these four commands are the agent's own proof of correctness."

No commit for this task — it is verification only. If any step fails, return to the relevant earlier task, fix, and re-commit there.
