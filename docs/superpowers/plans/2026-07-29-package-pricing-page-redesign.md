# Package Pricing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/package` as a pricing table — billing cycle as a toggle, store types as columns, price as the visual anchor — with reordering moved behind an arrange mode.

**Architecture:** Presentation-only. `src/stores/package-store.ts` and `src/services/package/` are not modified; they already expose the catalog, the three reorder actions, a `sortingScope` flag, and a single-flight reorder guard. The two-pane navigator is deleted and its three jobs redistributed: cycle selection to a toggle, plan selection to the columns themselves, reordering to an arrange mode.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Zustand, shadcn/ui-style local primitives, dnd-kit, i18next.

## Global Constraints

- Communicate with the user in Thai only. Code, comments, and commit messages in English except Lao/Thai UI copy.
- Never use `any`. `interface` for props/models, `type` for unions, `as const` over enums.
- Every new i18n key must exist in **both** `public/locales/en/common.json` and `public/locales/la/common.json`. `src/lib/i18n-resources.test.ts` fails on missing parity.
- Tests cover pure logic only — no component tests. Colocated `.test.ts`, node environment.
- Preserve dark mode in everything touched. Minimum 44px touch targets on mobile controls.
- `/package` is in `FIXED_DATA_SCREEN_PATHS`; the shell locks body scroll and the page owns its scroll region. The page must never scroll horizontally at the body level.
- Verify with `npm run typecheck`, `npm run lint`, `npm test` before each commit.
- Do not modify `package-form-dialog.tsx` or `package-plan-dialog.tsx`.
- Do not modify `src/stores/package-store.ts` or anything under `src/services/package/`.

## Decision: fetch limit replaces pagination

The spec removes pagination. `PackageQuery` still requires `page`, `limit`, and `search`, so the page passes constants: `page: 1`, `search: ""`, `limit: 50` (exported as `PACKAGE_FETCH_LIMIT`).

Fifty covers current data (6 packages) with headroom. To prevent silent data loss if the catalog ever exceeds it, the workspace renders a single truncation line when `total > loaded` — no pagination controls, just an honest count. This is the one addition beyond the spec; it costs one line of UI and removes a silent-failure mode.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/features/package/package-ui-utils.ts` (modify) | Add `monthlyEquivalentPrice`, `cycleSavingsPercent`, `orderedPlanColumns`. Remove `packageRange` and `firstPlanId` once unused. |
| `src/features/package/package-cycle-toggle.tsx` (create) | Cycle segmented control; in arrange mode, a draggable chip row. |
| `src/features/package/package-price-card.tsx` (create) | One package: price hero, names, checked feature list, edit action, detail reordering in arrange mode. |
| `src/features/package/package-pricing-grid.tsx` (create) | Column grid, dashed create-package card, dashed create-plan column, plan reordering in arrange mode. |
| `src/features/package/package-toolbar.tsx` (modify) | Status filter, arrange toggle, refresh, add package. Search removed. |
| `src/features/package/package-workspace.tsx` (modify) | Composes toggle + grid + loading/error/empty/truncation states. |
| `src/features/package/package-page.tsx` (modify) | Controller. Search and pagination state removed, arrange state added. |
| `src/features/package/package-navigator.tsx` (delete) | Superseded. |
| `src/features/package/package-card.tsx` (delete) | Superseded by `package-price-card.tsx`. |
| `src/app/(protected)/package/page.tsx` (modify) | Stops parsing URL pagination. |

---

### Task 1: Pricing helpers

**Files:**
- Modify: `src/features/package/package-ui-utils.ts`
- Test: `src/features/package/package-ui-utils.test.ts`

**Interfaces:**
- Consumes: `BillingCycle`, `PackagePlan`, `PackagePlanGroup` from `@/services/package`.
- Produces:
  - `monthlyEquivalentPrice(price: number, months: number): number`
  - `cycleSavingsPercent(monthlyPrice: number, cyclePrice: number, months: number): number | null`
  - `orderedPlanColumns(group: PackagePlanGroup | null): PackagePlan[]`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/package/package-ui-utils.test.ts`:

```ts
describe("monthlyEquivalentPrice", () => {
  it("divides a cycle price across its months", () => {
    expect(monthlyEquivalentPrice(1_200_000, 12)).toBe(100_000);
  });

  it("returns the price unchanged for a one-month cycle", () => {
    expect(monthlyEquivalentPrice(400_000, 1)).toBe(400_000);
  });

  it("falls back to the price when months is zero or negative", () => {
    expect(monthlyEquivalentPrice(400_000, 0)).toBe(400_000);
    expect(monthlyEquivalentPrice(400_000, -3)).toBe(400_000);
  });

  it("rounds to a whole kip", () => {
    expect(monthlyEquivalentPrice(1_000_000, 3)).toBe(333_333);
  });
});

describe("cycleSavingsPercent", () => {
  it("returns the discount against paying monthly for the same span", () => {
    expect(cycleSavingsPercent(100_000, 1_020_000, 12)).toBe(15);
  });

  it("returns null when the cycle price matches the monthly total", () => {
    expect(cycleSavingsPercent(400_000, 400_000, 1)).toBeNull();
  });

  it("returns null when the cycle costs more than paying monthly", () => {
    expect(cycleSavingsPercent(100_000, 1_400_000, 12)).toBeNull();
  });

  it("returns null when either price is missing or months is invalid", () => {
    expect(cycleSavingsPercent(0, 1_020_000, 12)).toBeNull();
    expect(cycleSavingsPercent(100_000, 0, 12)).toBeNull();
    expect(cycleSavingsPercent(100_000, 1_020_000, 0)).toBeNull();
  });
});

describe("orderedPlanColumns", () => {
  it("returns an empty list for a missing group", () => {
    expect(orderedPlanColumns(null)).toEqual([]);
  });

  it("orders plans by sort order", () => {
    const group = {
      billingCycleId: "cycle-1",
      billingCycleName: "Monthly",
      months: 1,
      status: 1,
      sortOrder: 1,
      plans: [
        { id: "plan-b", billingCycleId: "cycle-1", methodId: "m-b", methodName: "B", methodStatus: 1, status: 1, sortOrder: 2 },
        { id: "plan-a", billingCycleId: "cycle-1", methodId: "m-a", methodName: "A", methodStatus: 1, status: 1, sortOrder: 1 }
      ]
    };

    expect(orderedPlanColumns(group).map((plan) => plan.id)).toEqual([
      "plan-a",
      "plan-b"
    ]);
  });

  it("breaks sort-order ties by id so equal values never reshuffle", () => {
    const group = {
      billingCycleId: "cycle-1",
      billingCycleName: "Monthly",
      months: 1,
      status: 1,
      sortOrder: 1,
      plans: [
        { id: "plan-z", billingCycleId: "cycle-1", methodId: "m-z", methodName: "Z", methodStatus: 1, status: 1, sortOrder: 1 },
        { id: "plan-a", billingCycleId: "cycle-1", methodId: "m-a", methodName: "A", methodStatus: 1, status: 1, sortOrder: 1 }
      ]
    };

    expect(orderedPlanColumns(group).map((plan) => plan.id)).toEqual([
      "plan-a",
      "plan-z"
    ]);
  });
});
```

Add the three names to the existing import at the top of the test file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/package/package-ui-utils.test.ts`
Expected: FAIL — `monthlyEquivalentPrice is not a function` (and the other two).

- [ ] **Step 3: Implement the helpers**

Append to `src/features/package/package-ui-utils.ts`:

```ts
export function monthlyEquivalentPrice(price: number, months: number): number {
  if (months <= 1) return price;
  return Math.round(price / months);
}

// เทียบราคาต่อรอบกับการจ่ายรายเดือนตลอดช่วงเดียวกัน คืน null เมื่อเทียบไม่ได้
// หรือไม่ได้ประหยัด เพื่อให้ฝั่ง UI ซ่อน badge ไปเลยแทนที่จะโชว์ 0%
export function cycleSavingsPercent(
  monthlyPrice: number,
  cyclePrice: number,
  months: number,
): number | null {
  if (monthlyPrice <= 0 || cyclePrice <= 0 || months <= 1) return null;

  const monthlyTotal = monthlyPrice * months;
  const savings = Math.round(((monthlyTotal - cyclePrice) / monthlyTotal) * 100);
  return savings > 0 ? savings : null;
}

export function orderedPlanColumns(
  group: PackagePlanGroup | null,
): PackagePlan[] {
  if (!group) return [];
  return [...group.plans].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/package/package-ui-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/package/package-ui-utils.ts src/features/package/package-ui-utils.test.ts
git commit -m "feat(package): add pricing table helpers"
```

---

### Task 2: Translation keys

**Files:**
- Modify: `public/locales/en/common.json`
- Modify: `public/locales/la/common.json`

**Interfaces:**
- Produces: the `packageManagement.*` keys every later task calls through `t()`.

- [ ] **Step 1: Add the English keys**

Inside the existing `packageManagement` object in `public/locales/en/common.json`:

```json
"arrange": "Arrange",
"arrangeDone": "Done arranging",
"arrangeHint": "Drag to reorder billing cycles, store types, and package details.",
"perMonth": "/month",
"perCycle": "/{{months}} months",
"monthlyEquivalent": "{{price}} per month",
"savingsBadge": "Save {{percent}}%",
"createPackageHere": "Create a package",
"createPackageHint": "This store type has no package yet.",
"truncated": "Showing {{shown}} of {{total}} packages."
```

- [ ] **Step 2: Add the matching Lao keys**

Inside the existing `packageManagement` object in `public/locales/la/common.json`:

```json
"arrange": "ຈັດລຳດັບ",
"arrangeDone": "ຈັດລຳດັບແລ້ວ",
"arrangeHint": "ລາກເພື່ອຈັດລຳດັບຮອບບິນ, ປະເພດຮ້ານ ແລະ ລາຍລະອຽດແພັກເກດ.",
"perMonth": "/ເດືອນ",
"perCycle": "/{{months}} ເດືອນ",
"monthlyEquivalent": "{{price}} ຕໍ່ເດືອນ",
"savingsBadge": "ປະຫຍັດ {{percent}}%",
"createPackageHere": "ສ້າງແພັກເກດ",
"createPackageHint": "ປະເພດຮ້ານນີ້ຍັງບໍ່ມີແພັກເກດ.",
"truncated": "ສະແດງ {{shown}} ຈາກ {{total}} ແພັກເກດ."
```

- [ ] **Step 3: Run the parity test**

Run: `npx vitest run src/lib/i18n-resources.test.ts`
Expected: PASS. A failure here means a key exists in one file but not the other — fix the mismatch before continuing.

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/common.json public/locales/la/common.json
git commit -m "feat(package): add pricing table copy"
```

---

### Task 3: Cycle toggle

**Files:**
- Create: `src/features/package/package-cycle-toggle.tsx`

**Interfaces:**
- Consumes: `BillingCycle` from `@/services/package`; `ToggleGroup`, `ToggleGroupItem` from `@/components/ui/toggle-group`; `useReorderSensors` from `@/hooks/use-reorder-sensors`.
- Produces:

```ts
interface PackageCycleToggleProps {
  arranging: boolean;
  cycles: BillingCycle[];
  reorderDisabled: boolean;
  selectedCycleId: string;
  onReorder: (cycles: BillingCycle[]) => void;
  onSelect: (cycleId: string) => void;
}

export function PackageCycleToggle(props: PackageCycleToggleProps): JSX.Element
```

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { cn } from "@/lib/utils";
import type { BillingCycle } from "@/services/package";

interface PackageCycleToggleProps {
  arranging: boolean;
  cycles: BillingCycle[];
  reorderDisabled: boolean;
  selectedCycleId: string;
  onReorder: (cycles: BillingCycle[]) => void;
  onSelect: (cycleId: string) => void;
}

export function PackageCycleToggle({
  arranging,
  cycles,
  reorderDisabled,
  selectedCycleId,
  onReorder,
  onSelect,
}: PackageCycleToggleProps) {
  const { t } = useTranslation();
  const sensors = useReorderSensors();
  const cycleIds = cycles.map((cycle) => cycle.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderDisabled) return;
    const oldIndex = cycleIds.indexOf(String(active.id));
    const newIndex = cycleIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(cycles, oldIndex, newIndex));
  }

  if (!arranging) {
    return (
      <ToggleGroup
        aria-label={t("packageManagement.billingCycle")}
        className="w-full sm:w-auto"
        type="single"
        value={selectedCycleId}
        variant="outline"
        onValueChange={(value) => {
          if (value) onSelect(value);
        }}
      >
        {cycles.map((cycle) => (
          <ToggleGroupItem
            key={cycle.id}
            className="h-11 flex-1 px-4 text-sm font-bold sm:h-8 sm:flex-none"
            value={cycle.id}
          >
            {cycle.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cycleIds} strategy={horizontalListSortingStrategy}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {cycles.map((cycle) => (
            <SortableCycleChip
              key={cycle.id}
              cycle={cycle}
              disabled={reorderDisabled}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCycleChip({
  cycle,
  disabled,
}: {
  cycle: BillingCycle;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: cycle.id, disabled });

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={`${t("packageManagement.dragToReorder")} ${cycle.name}`}
      className={cn(
        "flex h-11 min-w-0 cursor-grab items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-bold sm:h-8",
        isDragging && "z-10 opacity-80 shadow-md",
        disabled && "cursor-not-allowed opacity-60",
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <GripVertical aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{cycle.name}</span>
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors. `restrictToHorizontalAxis` and `horizontalListSortingStrategy` both ship with the installed dnd-kit packages already used by `package-card.tsx`.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/package/package-cycle-toggle.tsx
git commit -m "feat(package): add billing cycle toggle"
```

---

### Task 4: Price card

**Files:**
- Create: `src/features/package/package-price-card.tsx`

**Interfaces:**
- Consumes: `monthlyEquivalentPrice` from Task 1; `PackageDetail`, `PackageItem` from `@/services/package`; `Language` from `@/lib/language`; `StatusBadge` from `@/components/common/status-badge`.
- Produces:

```ts
interface PackagePriceCardProps {
  arranging: boolean;
  item: PackageItem;
  language: Language;
  months: number;
  reorderDisabled: boolean;
  savingsPercent: number | null;
  onEdit?: (item: PackageItem) => void;
  onReorderDetails: (details: PackageDetail[]) => void;
}

export function PackagePriceCard(props: PackagePriceCardProps): JSX.Element
```

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/language";
import type { PackageDetail, PackageItem } from "@/services/package";
import { monthlyEquivalentPrice } from "@/features/package/package-ui-utils";

interface PackagePriceCardProps {
  arranging: boolean;
  item: PackageItem;
  language: Language;
  months: number;
  reorderDisabled: boolean;
  savingsPercent: number | null;
  onEdit?: (item: PackageItem) => void;
  onReorderDetails: (details: PackageDetail[]) => void;
}

function localizedName(
  entry: Pick<PackageItem | PackageDetail, "name" | "nameEn" | "nameLa">,
  language: Language,
): string {
  return language === "en"
    ? entry.nameEn || entry.name || entry.nameLa
    : entry.nameLa || entry.name || entry.nameEn;
}

function formatKip(price: number, language: Language): string {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "lo-LA", {
    maximumFractionDigits: 0,
  }).format(price);
}

export function PackagePriceCard({
  arranging,
  item,
  language,
  months,
  reorderDisabled,
  savingsPercent,
  onEdit,
  onReorderDetails,
}: PackagePriceCardProps) {
  const { t } = useTranslation();
  const sensors = useReorderSensors();
  const detailIds = item.details.map(
    (detail, index) => detail.id || `${item.id}-detail-${index}`,
  );
  const perMonth = monthlyEquivalentPrice(item.price, months);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderDisabled) return;
    const oldIndex = detailIds.indexOf(String(active.id));
    const newIndex = detailIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderDetails(arrayMove(item.details, oldIndex, newIndex));
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-bold text-muted-foreground">
            {localizedName(item, language)}
          </p>
          <StatusBadge active={item.status === 1} />
        </div>

        <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">
          {formatKip(item.price, language)}
          <span className="ml-1 text-base font-bold text-muted-foreground">
            ₭
          </span>
          <span className="ml-1 text-sm font-bold text-muted-foreground">
            {months > 1
              ? t("packageManagement.perCycle", { months })
              : t("packageManagement.perMonth")}
          </span>
        </p>

        {months > 1 ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("packageManagement.monthlyEquivalent", {
              price: `${formatKip(perMonth, language)} ₭`,
            })}
          </p>
        ) : null}

        {savingsPercent !== null ? (
          <Badge className="w-fit border-primary/25 bg-primary/10 text-primary">
            {t("packageManagement.savingsBadge", { percent: savingsPercent })}
          </Badge>
        ) : null}
      </div>

      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={detailIds} strategy={verticalListSortingStrategy}>
          <ul className="flex min-w-0 flex-col gap-2">
            {item.details.map((detail, index) => (
              <DetailRow
                key={detailIds[index]}
                arranging={arranging}
                detail={detail}
                disabled={reorderDisabled}
                language={language}
                sortableId={detailIds[index]}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-11 w-full sm:h-8"
        disabled={!onEdit}
        onClick={() => onEdit?.(item)}
      >
        <Pencil data-icon="inline-start" />
        {t("packageManagement.editPackage")}
      </Button>
    </div>
  );
}

function DetailRow({
  arranging,
  detail,
  disabled,
  language,
  sortableId,
}: {
  arranging: boolean;
  detail: PackageDetail;
  disabled: boolean;
  language: Language;
  sortableId: string;
}) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sortableId, disabled: disabled || !arranging });
  const name = localizedName(detail, language);

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm",
        detail.status !== 1 && "opacity-50",
        isDragging && "z-10 opacity-80",
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {arranging ? (
        <button
          type="button"
          aria-label={`${t("packageManagement.dragToReorder")} ${name}`}
          className={cn(
            "flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground",
            disabled && "cursor-not-allowed opacity-60",
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : (
        <Check aria-hidden className="size-4 shrink-0 text-primary" />
      )}
      <span className="min-w-0 truncate">{name}</span>
    </li>
  );
}
```

Add `import { useReorderSensors } from "@/hooks/use-reorder-sensors";` to the import block — it is used by `PackagePriceCard`.

- [ ] **Step 2: Verify it compiles and lints**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

`StatusBadge` takes `{ active: boolean; className?: string; label?: string }`, so the `active={item.status === 1}` call above is correct as written.

- [ ] **Step 3: Commit**

```bash
git add src/features/package/package-price-card.tsx
git commit -m "feat(package): add pricing card"
```

---

### Task 5: Pricing grid

**Files:**
- Create: `src/features/package/package-pricing-grid.tsx`

**Interfaces:**
- Consumes: `PackagePriceCard` (Task 4), `orderedPlanColumns` and `cycleSavingsPercent` (Task 1), `packagesForPlan` (existing).
- Produces:

```ts
interface PackagePricingGridProps {
  arranging: boolean;
  language: Language;
  months: number;
  packageGroups: PackageBillingGroup[];
  plans: PackagePlan[];
  monthlyPriceByMethodId: Map<string, number>;
  reorderDisabled: boolean;
  onAddPackage: (planId: string) => void;
  onAddPlan: () => void;
  onEditPackage: (item: PackageItem) => void;
  onReorderDetails: (packageId: string, details: PackageDetail[]) => void;
  onReorderPlans: (plans: PackagePlan[]) => void;
}

export function PackagePricingGrid(props: PackagePricingGridProps): JSX.Element
```

`monthlyPriceByMethodId` maps a method id to the price of that method's package in the one-month cycle. Task 6 builds it; the grid only reads it so the savings badge stays a pure lookup.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/language";
import type {
  PackageBillingGroup,
  PackageDetail,
  PackageItem,
  PackagePlan,
} from "@/services/package";
import { PackagePriceCard } from "@/features/package/package-price-card";
import {
  cycleSavingsPercent,
  packagesForPlan,
} from "@/features/package/package-ui-utils";

interface PackagePricingGridProps {
  arranging: boolean;
  language: Language;
  months: number;
  packageGroups: PackageBillingGroup[];
  plans: PackagePlan[];
  monthlyPriceByMethodId: Map<string, number>;
  reorderDisabled: boolean;
  onAddPackage: (planId: string) => void;
  onAddPlan: () => void;
  onEditPackage: (item: PackageItem) => void;
  onReorderDetails: (packageId: string, details: PackageDetail[]) => void;
  onReorderPlans: (plans: PackagePlan[]) => void;
}

export function PackagePricingGrid({
  arranging,
  language,
  months,
  packageGroups,
  plans,
  monthlyPriceByMethodId,
  reorderDisabled,
  onAddPackage,
  onAddPlan,
  onEditPackage,
  onReorderDetails,
  onReorderPlans,
}: PackagePricingGridProps) {
  const sensors = useReorderSensors();
  const planIds = plans.map((plan) => plan.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderDisabled) return;
    const oldIndex = planIds.indexOf(String(active.id));
    const newIndex = planIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderPlans(arrayMove(plans, oldIndex, newIndex));
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={planIds} strategy={horizontalListSortingStrategy}>
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
          {plans.map((plan) => (
            <PlanColumn
              key={plan.id}
              arranging={arranging}
              language={language}
              months={months}
              monthlyPrice={monthlyPriceByMethodId.get(plan.methodId) ?? 0}
              packages={packagesForPlan(packageGroups, plan.id)}
              plan={plan}
              reorderDisabled={reorderDisabled}
              onAddPackage={onAddPackage}
              onEditPackage={onEditPackage}
              onReorderDetails={onReorderDetails}
            />
          ))}

          <AddPlanColumn onAddPlan={onAddPlan} />
        </div>
      </SortableContext>
    </DndContext>
  );
}

function PlanColumn({
  arranging,
  language,
  months,
  monthlyPrice,
  packages,
  plan,
  reorderDisabled,
  onAddPackage,
  onEditPackage,
  onReorderDetails,
}: {
  arranging: boolean;
  language: Language;
  months: number;
  monthlyPrice: number;
  packages: PackageItem[];
  plan: PackagePlan;
  reorderDisabled: boolean;
  onAddPackage: (planId: string) => void;
  onEditPackage: (item: PackageItem) => void;
  onReorderDetails: (packageId: string, details: PackageDetail[]) => void;
}) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: plan.id, disabled: reorderDisabled || !arranging });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-col gap-3",
        isDragging && "z-10 opacity-80",
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <header className="flex min-w-0 items-center gap-2">
        {arranging ? (
          <button
            type="button"
            aria-label={`${t("packageManagement.dragToReorder")} ${plan.methodName}`}
            className={cn(
              "flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground",
              reorderDisabled && "cursor-not-allowed opacity-60",
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        ) : null}
        <h2 className="min-w-0 truncate text-sm font-black text-foreground">
          {plan.methodName}
        </h2>
      </header>

      {packages.length ? (
        packages.map((item) => (
          <PackagePriceCard
            key={item.id}
            arranging={arranging}
            item={item}
            language={language}
            months={months}
            reorderDisabled={reorderDisabled}
            savingsPercent={cycleSavingsPercent(monthlyPrice, item.price, months)}
            onEdit={onEditPackage}
            onReorderDetails={(details) => onReorderDetails(item.id, details)}
          />
        ))
      ) : (
        <button
          type="button"
          className="flex min-h-40 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 p-4 text-center transition hover:border-primary hover:bg-primary/5"
          onClick={() => onAddPackage(plan.id)}
        >
          <Plus aria-hidden className="size-5 text-primary" />
          <span className="text-sm font-bold text-foreground">
            {t("packageManagement.createPackageHere")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("packageManagement.createPackageHint")}
          </span>
        </button>
      )}
    </section>
  );
}

function AddPlanColumn({ onAddPlan }: { onAddPlan: () => void }) {
  const { t } = useTranslation();

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="h-5" aria-hidden />
      <Button
        type="button"
        variant="outline"
        className="flex min-h-40 w-full flex-col items-center justify-center gap-2 border-dashed"
        onClick={onAddPlan}
      >
        <Plus aria-hidden className="size-5" />
        <span className="text-sm font-bold">
          {t("packageManagement.addPlan")}
        </span>
      </Button>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/package/package-pricing-grid.tsx
git commit -m "feat(package): add pricing grid"
```

---

### Task 6: Toolbar

**Files:**
- Modify: `src/features/package/package-toolbar.tsx`

**Interfaces:**
- Produces: the toolbar props Task 7 passes.

```ts
interface PackageToolbarProps {
  arranging: boolean;
  refreshing: boolean;
  status: PackageStatusFilter;
  onRefresh: () => void;
  onToggleArrange: () => void;
  onStatusChange: (value: PackageStatusFilter) => void;
}
```

`canAddPackage`, `search`, `onSearchChange`, and `onAddPackage` are removed — creating a package now happens from the empty slot inside its column, so the toolbar no longer needs a plan to be selected.

- [ ] **Step 1: Replace the props interface and component body**

Delete the `SearchInput` import and the `PackagePlus` import. Replace the interface with the one above, then replace the returned JSX with:

```tsx
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
      <Select
        value={status}
        onValueChange={(value) => onStatusChange(value as PackageStatusFilter)}
      >
        <SelectTrigger
          aria-label={t("packageManagement.statusLabel")}
          className="h-11! w-full min-w-0 sm:h-8! sm:w-36"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            <SelectItem value="all">{t("packageManagement.all")}</SelectItem>
            <SelectItem value="1">{t("packageManagement.active")}</SelectItem>
            <SelectItem value="2">{t("packageManagement.inactive")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button
        type="button"
        size="sm"
        variant={arranging ? "default" : "outline"}
        className="h-11 sm:h-8"
        aria-pressed={arranging}
        onClick={onToggleArrange}
      >
        <ArrowUpDown data-icon="inline-start" />
        {arranging
          ? t("packageManagement.arrangeDone")
          : t("packageManagement.arrange")}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="size-11 px-0 sm:size-auto sm:h-8 sm:px-3"
        aria-label={t("packageManagement.refresh")}
        disabled={refreshing}
        onClick={onRefresh}
      >
        {refreshing ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RefreshCw data-icon="inline-start" />
        )}
        <span className="hidden lg:inline">{t("packageManagement.refresh")}</span>
      </Button>
    </div>
  );
```

Change the lucide import to `import { ArrowUpDown, RefreshCw } from "lucide-react";`.

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: errors only in `package-page.tsx` and `package-workspace.tsx`, which still pass the removed props. Task 7 fixes them.

- [ ] **Step 3: Commit**

```bash
git add src/features/package/package-toolbar.tsx
git commit -m "refactor(package): slim the toolbar to filter and arrange"
```

---

### Task 7: Wire the workspace and page, delete the old layout

**Files:**
- Modify: `src/features/package/package-workspace.tsx`
- Modify: `src/features/package/package-page.tsx`
- Modify: `src/app/(protected)/package/page.tsx`
- Delete: `src/features/package/package-navigator.tsx`
- Delete: `src/features/package/package-card.tsx`

**Interfaces:**
- Consumes everything produced by Tasks 1–6.

- [ ] **Step 1: Rewrite the workspace**

`package-workspace.tsx` keeps its loading, error, and empty handling and drops the navigator. Its props become:

```ts
interface PackageWorkspaceProps {
  arranging: boolean;
  billingCycles: BillingCycle[];
  catalogReady: boolean;
  language: Language;
  loadError: string | null;
  loading: boolean;
  months: number;
  monthlyPriceByMethodId: Map<string, number>;
  packageGroups: PackageBillingGroup[];
  plans: PackagePlan[];
  reorderDisabled: boolean;
  selectedCycleId: string;
  shownCount: number;
  total: number;
  onAddPackage: (planId: string) => void;
  onAddPlan: () => void;
  onEditPackage: (item: PackageItem) => void;
  onReorderCycles: (cycles: BillingCycle[]) => void;
  onReorderDetails: (packageId: string, details: PackageDetail[]) => void;
  onReorderPlans: (plans: PackagePlan[]) => void;
  onRetry: () => void;
  onSelectCycle: (cycleId: string) => void;
}
```

Body order: cycle toggle row, arrange hint when `arranging`, then one of — skeleton grid while `loading && !catalogReady`, the `Alert` retry block when `loadError`, the `Empty` block when there are no billing cycles, otherwise `PackagePricingGrid`. Below the grid, render the truncation line only when `total > shownCount`:

```tsx
{total > shownCount ? (
  <p className="shrink-0 px-1 py-2 text-xs text-muted-foreground">
    {t("packageManagement.truncated", { shown: shownCount, total })}
  </p>
) : null}
```

Keep the existing `Alert`, `Empty`, `Skeleton`, and `Spinner` usage rather than inventing new state components.

- [ ] **Step 2: Update the page controller**

In `package-page.tsx`:

1. Delete `searchDraft`, `search`, and their debounce effect.
2. Delete `useUrlPagination`, `goToPage`, `resetPage`, `requestedLimit`, `requestedPage`, `pageLimit`, and the `initialPagination` prop.
3. Delete the `PACKAGE_PAGE_LIMIT_OPTIONS` constant and export `export const PACKAGE_FETCH_LIMIT = 50;`.
4. Build the query with constants:

```ts
const query = useMemo<PackageQuery>(
  () => ({
    language,
    limit: PACKAGE_FETCH_LIMIT,
    orderBy: "asc",
    page: 1,
    search: "",
    status: queryStatus,
  }),
  [language, queryStatus],
);
```

5. Simplify the load effect — with no pagination there is no page clamp to apply:

```ts
useEffect(() => {
  const background = usePackageStore.getState().catalogReady;

  void loadCatalog(query, { background }).catch(() => {
    // The store owns load errors for UI retries and internal refreshes.
  });
}, [loadCatalog, query]);
```

6. Add `const [arranging, setArranging] = useState(false);`.
7. Derive the values the grid needs:

```ts
const activeGroup =
  navigation.planGroups.find(
    (group) => group.billingCycleId === navigation.cycleId,
  ) ?? null;
const plans = useMemo(() => orderedPlanColumns(activeGroup), [activeGroup]);
const months = activeGroup?.months ?? 1;
// ราคาต่อเดือนของแต่ละประเภทร้าน ใช้เป็นฐานคำนวณ badge ส่วนลดของรอบบิลอื่น
const monthlyPriceByMethodId = useMemo(() => {
  const monthlyGroup = navigation.planGroups.find((group) => group.months === 1);
  const prices = new Map<string, number>();
  for (const plan of monthlyGroup?.plans ?? []) {
    const [first] = packagesForPlan(packageGroups, plan.id);
    if (first) prices.set(plan.methodId, first.price);
  }
  return prices;
}, [navigation.planGroups, packageGroups]);
const shownCount = useMemo(
  () =>
    plans.reduce(
      (count, plan) => count + packagesForPlan(packageGroups, plan.id).length,
      0,
    ),
  [packageGroups, plans],
);
```

8. `onAddPackage(planId)` sets `selectedPlanId` to that plan, clears `editingPackage`, and opens the package dialog, so the dialog's plan select lands on the column the user clicked.
9. Remove the `PackageOpen` header icon block only if the header is restructured; otherwise leave it.

- [ ] **Step 3: Simplify the route file**

`src/app/(protected)/package/page.tsx` becomes:

```tsx
import { PackagePage } from "@/features/package/package-page";

export default function Page() {
  return <PackagePage />;
}
```

Drop the `parseUrlPagination` import.

- [ ] **Step 4: Delete the superseded files**

```bash
git rm src/features/package/package-navigator.tsx src/features/package/package-card.tsx
```

- [ ] **Step 5: Remove helpers that are now unused**

`packageRange` and `firstPlanId` in `package-ui-utils.ts` lose their last callers. Confirm with `grep -rn "packageRange\|firstPlanId" src/`, then delete both functions and their test blocks.

- [ ] **Step 6: Verify the whole suite**

Run: `npm run typecheck && npm run lint && npm test -- --run`
Expected: all pass, no references to the deleted files.

- [ ] **Step 7: Verify in the browser**

Start the dev server if it is not already running, then check `http://localhost:3000/package`:

1. Columns render side by side, one per store type, price prominent.
2. The cycle toggle switches between monthly and yearly and the columns change.
3. Arrange mode reveals grip handles at all three levels and hides them again when toggled off.
4. A plan with no package shows the dashed create card and opens the dialog with that plan preselected.
5. The status filter narrows the grid.
6. Resize to tablet and mobile widths — no horizontal scrollbar on the body.
7. Toggle dark mode and confirm contrast on cards, badges, and dashed borders.

- [ ] **Step 8: Commit**

```bash
git add -A src/features/package src/app/\(protected\)/package
git commit -m "feat(package): rebuild the package page as a pricing table"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
| --- | --- |
| Layout: cycle toggle, method columns | 3, 5, 7 |
| Plan holds `packages[]` | 5 — `PlanColumn` maps over the array |
| Deleted: navigator, card | 7 |
| Created: toggle, grid, price card | 3, 5, 4 |
| Modified: toolbar, workspace, page | 6, 7 |
| Dialogs untouched | Enforced by Global Constraints |
| Store and services untouched | Enforced by Global Constraints |
| Arrange mode across three endpoints | 3 (cycles), 5 (plans), 4 (details) |
| Responsive breakpoints | 5 grid classes, verified in 7 Step 7 |
| States: loading, refreshing, error, empty | 7 Step 1 |
| Savings badge, hidden when not positive | 1 (`cycleSavingsPercent`), 4 (render), 5 (lookup) |
| Testing: three helpers plus i18n parity | 1, 2 |
| Out of scope items | No task creates cycle/method/delete affordances |

**Placeholder scan:** No TBD or TODO. Every code step carries real code. Step 2 of Task 4 asks the implementer to check the real `StatusBadge` signature rather than assuming it — that is a verification instruction, not a placeholder.

**Type consistency:** `monthlyEquivalentPrice`, `cycleSavingsPercent`, and `orderedPlanColumns` keep the same signatures in Tasks 1, 4, 5, and 7. `monthlyPriceByMethodId` is `Map<string, number>` in Tasks 5 and 7. `PackageStatusFilter` keeps its existing export from `package-toolbar.tsx`, which Task 7 still imports.
