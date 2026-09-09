# Employee Sales Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `/report/employee-sales` page that lets a manager filter by branch, employee (searchable, optional), and date range, then see one summary row per employee with a drill-down detail sheet, per `docs/superpowers/specs/2026-09-09-employee-sales-report-design.md`.

**Architecture:** Mirrors the existing `order-audit` feature exactly: a new service (`src/services/report/employee-sales.ts`), a `createSimpleReportStore`-based store (no pagination — the API returns every matching employee in one response), and a self-composed page (toolbar + filter sheet + desktop table / mobile card list + detail sheet), with no shared `ReportPageShell` and no export/print. A new searchable employee combobox mirrors the existing `ProvinceCombobox`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 semantic tokens, shadcn/ui (`Sheet`, `Table`, `Card`, `Badge`, `Alert`, `Accordion`, `Popover`, `Command`, `Input`, `Button`, `Skeleton`), Zustand, react-i18next, Vitest 4.

## Global Constraints

- Never use `any` (CLAUDE.md Non-negotiable 1).
- Route files under `src/app/` stay thin — render one feature component, nothing else (Non-negotiable 2).
- No ad-hoc `fetch` in components; all data access goes through `src/services/` (Non-negotiable 3).
- Components call store actions, never services directly (Non-negotiable 4) — the page calls `useEmployeeSalesReportStore`, never `getEmployeeSalesReport` directly.
- No raw palette colors, arbitrary fonts, or new global CSS — only semantic tokens from `globals.css` (Non-negotiable 8).
- Any new i18n key must exist in both `public/locales/en/common.json` and `public/locales/la/common.json`, or `src/lib/i18n-resources.test.ts` fails.
- Tests cover pure logic only (Vitest) — no component tests; UI verification is manual in the browser.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` must all stay clean.
- No export/PDF/print, no per-column server sort, no multi-employee selection — all explicitly out of scope per the spec.
- `login_uuid` is always sent as a single value or omitted entirely — never a comma-separated list.

---

### Task 1: Add the `employeeSales` i18n namespace and the role-id config constant

**Files:**
- Modify: `public/locales/en/common.json` (new top-level key, inserted after the `orderAudit` block ends at line 125, before `"actions"` at line 126)
- Modify: `public/locales/la/common.json` (same position)
- Create: `src/config/employee-sales.ts`
- Test: `src/lib/i18n-resources.test.ts` (existing test, no changes — just must keep passing)

**Interfaces:**
- Produces: translation keys under `employeeSales.*` (listed below), and `EMPLOYEE_SALES_ROLE_ID` (a `number` constant) — consumed by Task 2 (`getEmployeeOptions` caller) and Task 6 (`useEmployeeOptions`).

- [ ] **Step 1: Insert the English block**

In `public/locales/en/common.json`, right after line 125 (`  },` closing `orderAudit`) and before line 126 (`"actions": {`), insert:

```json
  "employeeSales": {
    "title": "Employee Sales Report",
    "description": "Sales totals grouped by employee for the selected branch and date range.",
    "allEmployees": "All employees",
    "searchEmployee": "Search employee",
    "noEmployeesFound": "No employees found",
    "employee": "Employee",
    "billCount": "Bills",
    "totalQty": "Qty",
    "netSale": "Net Sale",
    "serviceCharge": "Service Charge",
    "vat": "VAT",
    "grandTotal": "Grand Total",
    "cancelledBadge": "{{count}} cancelled",
    "summaryLine": "{{employeeCount}} employees · {{billCount}} bills",
    "empty": "No sales found",
    "emptyDescription": "Try another date range or filter.",
    "invalidDateRange": "Select a valid date range.",
    "paymentSummary": "Payment summary",
    "cash": "Cash",
    "transfer": "Transfer",
    "credit": "Credit",
    "paymentTotal": "Total",
    "orderChannels": "Order channels",
    "cancelSummary": "Cancelled bills",
    "cancelSummaryDescription": "{{count}} bills, {{amount}}",
    "orders": "Bills",
    "invoice": "Invoice",
    "saleDate": "Sale date",
    "groups": "Sales by category",
    "grossAmount": "Gross amount",
    "discountAmount": "Discount",
    "totalAmount": "Total amount",
    "items": "Items",
    "productName": "Product",
    "unitPrice": "Unit price"
  },
```

- [ ] **Step 2: Insert the matching Lao block**

In `public/locales/la/common.json`, at the same position (after line 125, before line 126), insert:

```json
  "employeeSales": {
    "title": "ລາຍງານການຂາຍຕາມພະນັກງານ",
    "description": "ຍອດຂາຍລວມແຍກຕາມພະນັກງານ ສຳລັບສາຂາ ແລະ ຊ່ວງວັນທີທີ່ເລືອກ.",
    "allEmployees": "ພະນັກງານທັງໝົດ",
    "searchEmployee": "ຄົ້ນຫາພະນັກງານ",
    "noEmployeesFound": "ບໍ່ພົບພະນັກງານ",
    "employee": "ພະນັກງານ",
    "billCount": "ຈຳນວນບິນ",
    "totalQty": "ຈຳນວນ",
    "netSale": "ຍອດຂາຍສຸດທິ",
    "serviceCharge": "ຄ່າບໍລິການ",
    "vat": "ອາກອນມູນຄ່າເພີ່ມ",
    "grandTotal": "ຍອດລວມທັງໝົດ",
    "cancelledBadge": "ຍົກເລີກ {{count}} ບິນ",
    "summaryLine": "ພະນັກງານ {{employeeCount}} ຄົນ · {{billCount}} ບິນ",
    "empty": "ບໍ່ພົບຂໍ້ມູນການຂາຍ",
    "emptyDescription": "ລອງປ່ຽນຊ່ວງວັນທີ ຫຼື ໂຕກອງ.",
    "invalidDateRange": "ເລືອກຊ່ວງວັນທີໃຫ້ຖືກຕ້ອງ.",
    "paymentSummary": "ສະຫຼຸບການຊຳລະ",
    "cash": "ເງິນສົດ",
    "transfer": "ໂອນເງິນ",
    "credit": "ຄ້າງຈ່າຍ",
    "paymentTotal": "ລວມ",
    "orderChannels": "ຊ່ອງທາງການສັ່ງ",
    "cancelSummary": "ບິນທີ່ຍົກເລີກ",
    "cancelSummaryDescription": "{{count}} ບິນ, {{amount}}",
    "orders": "ລາຍການບິນ",
    "invoice": "ເລກບິນ",
    "saleDate": "ວັນທີຂາຍ",
    "groups": "ຍອດຂາຍຕາມໝວດສິນຄ້າ",
    "grossAmount": "ຍອດລວມກ່ອນຫັກ",
    "discountAmount": "ສ່ວນຫຼຸດ",
    "totalAmount": "ຍອດລວມ",
    "items": "ລາຍການສິນຄ້າ",
    "productName": "ສິນຄ້າ",
    "unitPrice": "ລາຄາຕໍ່ຫົວໜ່ວຍ"
  },
```

- [ ] **Step 3: Create the config constant**

```ts
// src/config/employee-sales.ts
// GET /api/v1/register/fetch_all's roles_id_fk filter for this report's employee combobox
// is fixed by the API contract, not a user-facing choice — named here instead of inlined.
export const EMPLOYEE_SALES_ROLE_ID = 1;
```

- [ ] **Step 4: Run the i18n parity test**

Run: `npm test -- src/lib/i18n-resources.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/locales/en/common.json public/locales/la/common.json src/config/employee-sales.ts
git commit -m "$(cat <<'EOF'
Add employeeSales i18n namespace and role-id config constant

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `getEmployeeOptions` to the user service

**Files:**
- Modify: `src/services/user.ts`

**Interfaces:**
- Consumes: `apiRequest` from `@/lib/api`, `ApiDataResponse` and the existing `User` type already in this file.
- Produces: `getEmployeeOptions(branch_uuid_fk: string, roles_id_fk: number): Promise<User[]>` — consumed by Task 6 (`useEmployeeOptions`).

- [ ] **Step 1: Add the function**

In `src/services/user.ts`, after `getUsers` (around line 73), add:

```ts
// Unpaginated employee list for a branch, scoped by role — mirrors getBranchOptions'
// fetch_all + ApiDataResponse<T[]> shape. roles_id_fk is caller-supplied (not defaulted
// here) so this service stays generic; the "1" business meaning lives in the caller's config.
export async function getEmployeeOptions(branch_uuid_fk: string, roles_id_fk: number) {
  if (!branch_uuid_fk) return [];
  const result = await apiRequest<ApiDataResponse<User[]>>("get", "/api/v1/register/fetch_all", {
    params: { branch_uuid_fk, roles_id_fk }
  });
  return result.data ?? [];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/user.ts
git commit -m "$(cat <<'EOF'
Add getEmployeeOptions for the employee sales report's employee combobox

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create the employee-sales report service

**Files:**
- Create: `src/services/report/employee-sales.ts`
- Modify: `src/services/report/index.ts`

**Interfaces:**
- Consumes: `apiRequest`, `ServiceError` from `@/lib/api`; `toApiLanguage` from `@/lib/language`; `SortOrder` from `@/services/shared/types`.
- Produces: types `EmployeeSalesGroupItem`, `EmployeeSalesGroup`, `EmployeeSalesOrder`, `EmployeeSalesOrderChannel`, `EmployeeSalesSummary`, `EmployeeSalesPaymentSummary`, `EmployeeSalesCancelSummary`, `EmployeeSalesRow`, `EmployeeSalesReportSummary`, `EmployeeSalesParams`, `EmployeeSalesResponse`; function `getEmployeeSalesReport(params: EmployeeSalesParams): Promise<EmployeeSalesResponse>`. Consumed by Task 4 (store), Task 11 (table), Task 12 (row card), Task 13 (detail sheet), Task 14 (page).

- [ ] **Step 1: Write the service file**

```ts
import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { SortOrder } from "@/services/shared/types";

export interface EmployeeSalesGroupItem {
  order_uuid: string;
  order_invoice: string;
  sale_date: string;
  prod_uuid: string;
  product_full_name: string;
  unit_price: number;
  toppings: unknown[];
  total_qty: number;
  gross_amount: number;
  discount_amount: number;
  total_amount: number;
}

export interface EmployeeSalesGroup {
  group_uuid: string;
  group_name: string;
  total_qty: number;
  gross_amount: number;
  discount_amount: number;
  total_amount: number;
  items: EmployeeSalesGroupItem[];
}

export interface EmployeeSalesOrder {
  order_uuid: string;
  order_id: string;
  order_invoice: string;
  sale_date: string;
  sale_date_time: string;
  order_channel: number;
  total_qty: number;
  gross_amount: number;
  item_discount_amount: number;
  discount_bill: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
  cash: number;
  transfer: number;
  credit: number;
  employee_share: number;
}

export interface EmployeeSalesOrderChannel {
  order_channel: number;
  order_channel_name: string;
  bill_count: number;
  grand_total: number;
}

export interface EmployeeSalesSummary {
  order_count: number;
  bill_count: number;
  total_qty: number;
  gross_amount: number;
  item_discount_amount: number;
  bill_discount_amount: number;
  discount_amount: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
}

export interface EmployeeSalesPaymentSummary {
  cash: number;
  transfer: number;
  credit: number;
  payment_total: number;
}

export interface EmployeeSalesCancelSummary {
  cancel_bill_count: number;
  cancel_total_amount: number;
}

export interface EmployeeSalesRow {
  login_uuid: string;
  login_email: string;
  login_profile: string;
  login_active: number;
  roles_id: number;
  roles_name: string;
  branch_uuid_fk: string;
  branch_name: string;
  orders: EmployeeSalesOrder[];
  groups: EmployeeSalesGroup[];
  cancel_summary: EmployeeSalesCancelSummary;
  order_channels: EmployeeSalesOrderChannel[];
  summary: EmployeeSalesSummary;
  payment_summary: EmployeeSalesPaymentSummary;
}

export interface EmployeeSalesReportSummary extends EmployeeSalesSummary {
  employee_count: number;
  cash: number;
  transfer: number;
  credit: number;
  payment_total: number;
  cancel_bill_count: number;
  cancel_total_amount: number;
}

export interface EmployeeSalesParams {
  branch_uuid_fk: string;
  login_uuid?: string;
  date_from: string;
  date_to: string;
  lang?: string;
  orderBy?: SortOrder;
}

export interface EmployeeSalesResponse {
  user_reports: EmployeeSalesRow[];
  summary: EmployeeSalesReportSummary;
  filters: { branch_uuid_fk: string; login_uuid: string; date_from: string; date_to: string };
}

export function getEmployeeSalesReport(params: EmployeeSalesParams) {
  if (!params.branch_uuid_fk || !params.date_from || !params.date_to) {
    throw new ServiceError("Branch and date range are required", 400);
  }
  return apiRequest<EmployeeSalesResponse>("get", "/api/v1/report_all/user_report", {
    params: { ...params, login_uuid: params.login_uuid || undefined, lang: toApiLanguage(params.lang) },
  });
}
```

- [ ] **Step 2: Re-export from the report service barrel**

In `src/services/report/index.ts`, add a line so the file reads:

```ts
export * from "./types";
export * from "./requests";
export * from "./order-audit";
export * from "./employee-sales";
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/report/employee-sales.ts src/services/report/index.ts
git commit -m "$(cat <<'EOF'
Add employee sales report service and types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Create the employee-sales report store

**Files:**
- Create: `src/stores/report-store/employee-sales.ts`
- Modify: `src/stores/report-store.ts`

**Interfaces:**
- Consumes: `getEmployeeSalesReport`, `EmployeeSalesParams`, `EmployeeSalesResponse` from `@/services/report` (Task 3); `createSimpleReportStore` from `./create-report-store`; `registerSessionStoreReset` from `@/stores/session-store-registry`.
- Produces: `useEmployeeSalesReportStore` (a Zustand hook exposing `{ load, reset, loading, error, report }`) — consumed by Task 14 (page).

- [ ] **Step 1: Write the store file**

```ts
"use client";

import { getEmployeeSalesReport, type EmployeeSalesParams, type EmployeeSalesResponse } from "@/services/report";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createSimpleReportStore } from "./create-report-store";

export const useEmployeeSalesReportStore = createSimpleReportStore<
  EmployeeSalesParams, EmployeeSalesResponse, { report: EmployeeSalesResponse | null }
>({
  key: "employeeSales",
  fetch: getEmployeeSalesReport,
  finalize: (report) => ({ report }),
  emptyState: { report: null },
  clearOnStart: true,
});

registerSessionStoreReset("employee-sales-report", () => useEmployeeSalesReportStore.getState().reset());
```

- [ ] **Step 2: Re-export from the report-store barrel**

In `src/stores/report-store.ts`, add a line after the `useOrderAuditReportStore` export:

```ts
export { useOrderAuditReportStore } from "@/stores/report-store/order-audit";
export { useEmployeeSalesReportStore } from "@/stores/report-store/employee-sales";
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/report-store/employee-sales.ts src/stores/report-store.ts
git commit -m "$(cat <<'EOF'
Add employee sales report store

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add the pure filter-count helper

**Files:**
- Create: `src/features/report/employee-sales/employee-sales-utils.ts`
- Test: `src/features/report/employee-sales/employee-sales-utils.test.ts`

**Interfaces:**
- Produces: `activeEmployeeSalesFilterCount(filters: { dateFrom: string; dateTo: string; loginUuid: string }, today: string): number` — consumed by Task 10 (`employee-sales-toolbar.tsx`) and Task 14 (page), for the toolbar's filter-count badge. Mirrors `activeAuditFilterCount` in `order-audit-utils.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/report/employee-sales/employee-sales-utils.test.ts
import { describe, expect, it } from "vitest";
import { activeEmployeeSalesFilterCount } from "./employee-sales-utils";

describe("employee sales presentation", () => {
  it("counts only non-default filters, not the always-required branch/date fields", () => {
    const today = "2026-09-09";
    expect(activeEmployeeSalesFilterCount({ dateFrom: today, dateTo: today, loginUuid: "" }, today)).toBe(0);
    expect(activeEmployeeSalesFilterCount({ dateFrom: "2026-09-01", dateTo: today, loginUuid: "" }, today)).toBe(1);
    expect(activeEmployeeSalesFilterCount({ dateFrom: today, dateTo: today, loginUuid: "fc445438-e617-471c-9af3-262ae747932f" }, today)).toBe(1);
    expect(activeEmployeeSalesFilterCount({ dateFrom: "2026-09-01", dateTo: "2026-09-05", loginUuid: "fc445438-e617-471c-9af3-262ae747932f" }, today)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/report/employee-sales/employee-sales-utils.test.ts`
Expected: FAIL (`employee-sales-utils` module or the export does not exist).

- [ ] **Step 3: Implement the helper**

```ts
// src/features/report/employee-sales/employee-sales-utils.ts
export function activeEmployeeSalesFilterCount(
  filters: { dateFrom: string; dateTo: string; loginUuid: string },
  today: string,
) {
  let count = 0;
  if (filters.dateFrom !== today || filters.dateTo !== today) count += 1;
  if (filters.loginUuid) count += 1;
  return count;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/report/employee-sales/employee-sales-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/report/employee-sales/employee-sales-utils.ts src/features/report/employee-sales/employee-sales-utils.test.ts
git commit -m "$(cat <<'EOF'
Add activeEmployeeSalesFilterCount helper for the toolbar filter badge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Create the `useEmployeeOptions` hook

**Files:**
- Create: `src/features/report/employee-sales/use-employee-options.ts`

**Interfaces:**
- Consumes: `getEmployeeOptions` and the `User` type from `@/services/user` (Task 2); `EMPLOYEE_SALES_ROLE_ID` from `@/config/employee-sales` (Task 1).
- Produces: `useEmployeeOptions(branchUuid: string): { options: User[]; loading: boolean }` — consumed by Task 7 (`EmployeeCombobox`) and Task 9 (filter sheet).

- [ ] **Step 1: Write the hook**

```ts
// src/features/report/employee-sales/use-employee-options.ts
"use client";

import { useEffect, useState } from "react";
import { EMPLOYEE_SALES_ROLE_ID } from "@/config/employee-sales";
import { getEmployeeOptions, type User } from "@/services/user";

export function useEmployeeOptions(branchUuid: string) {
  const [options, setOptions] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchUuid) {
      setOptions([]);
      return;
    }
    let active = true;
    setLoading(true);
    getEmployeeOptions(branchUuid, EMPLOYEE_SALES_ROLE_ID)
      .then(rows => { if (active) setOptions(rows); })
      .catch(() => { if (active) setOptions([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchUuid]);

  return { options, loading };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/employee-sales/use-employee-options.ts
git commit -m "$(cat <<'EOF'
Add useEmployeeOptions hook to fetch a branch's employee list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Create the `EmployeeCombobox` component

**Files:**
- Create: `src/features/report/employee-sales/employee-combobox.tsx`

**Interfaces:**
- Consumes: `Button` (`@/components/ui/button`), `Command`/`CommandEmpty`/`CommandGroup`/`CommandInput`/`CommandItem`/`CommandList` (`@/components/ui/command`), `Popover`/`PopoverContent`/`PopoverTrigger` (`@/components/ui/popover`), `Spinner` (`@/components/ui/spinner`), `User` type (`@/services/user`).
- Produces: `EmployeeCombobox` component — consumed by Task 9 (`employee-sales-filter-sheet.tsx`).

- [ ] **Step 1: Write the component**

```tsx
// src/features/report/employee-sales/employee-combobox.tsx
"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, User as UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { User } from "@/services/user";

export function EmployeeCombobox({
  disabled = false,
  employees,
  id,
  loading = false,
  onValueChange,
  value: selectedValue,
}: {
  disabled?: boolean;
  employees: User[];
  id: string;
  loading?: boolean;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => employees.map(employee => ({
    label: employee.login_email || employee.login_uuid,
    searchText: [employee.login_uuid, employee.login_email, employee.roles_name].filter(Boolean).join(" ").toLowerCase(),
    value: employee.login_uuid,
  })), [employees]);
  const selected = options.find(option => option.value === selectedValue);
  const dropdownLoading = open && loading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-busy={dropdownLoading}
          className="w-full justify-between"
          disabled={disabled}
          id={id}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="min-w-0 truncate">{selected?.label || t("employeeSales.allEmployees")}</span>
          {dropdownLoading ? (
            <Spinner data-icon="inline-end" />
          ) : (
            <ChevronsUpDown className="opacity-50" data-icon="inline-end" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        side="bottom"
        sideOffset={6}
        onTouchMove={event => event.stopPropagation()}
        onWheel={event => event.stopPropagation()}
      >
        <Command
          className="[&_[data-slot=command-input-wrapper]]:h-8 [&_[data-slot=command-input]]:h-8 [&_[data-slot=command-item]]:py-1"
          filter={(value, search) => (value.includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder={t("employeeSales.searchEmployee")} />
          <CommandList className="max-h-48 overscroll-contain">
            <CommandEmpty>{t("employeeSales.noEmployeesFound")}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => { onValueChange(""); setOpen(false); }}>
                <UserIcon />
                <span className="min-w-0 flex-1 truncate">{t("employeeSales.allEmployees")}</span>
                <Check className={selectedValue === "" ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
              </CommandItem>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.searchText}`}
                  onSelect={() => { onValueChange(option.value); setOpen(false); }}
                >
                  <UserIcon />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <Check className={option.value === selectedValue ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/employee-sales/employee-combobox.tsx
git commit -m "$(cat <<'EOF'
Add searchable employee combobox for the employee sales filter sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Create the loading skeleton

**Files:**
- Create: `src/features/report/employee-sales/employee-sales-skeleton.tsx`

**Interfaces:**
- Consumes: `Skeleton` (`@/components/ui/skeleton`).
- Produces: `EmployeeSalesSkeleton()` — consumed by Task 14 (page).

- [ ] **Step 1: Write the component**

```tsx
// src/features/report/employee-sales/employee-sales-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = 6;
const SKELETON_COLUMNS = 6;

export function EmployeeSalesSkeleton() {
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
git add src/features/report/employee-sales/employee-sales-skeleton.tsx
git commit -m "$(cat <<'EOF'
Add table-shaped skeleton for the employee sales report

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Create the filter sheet

**Files:**
- Create: `src/features/report/employee-sales/employee-sales-filter-sheet.tsx`

**Interfaces:**
- Consumes: `Sheet`/`SheetContent`/`SheetFooter`/`SheetHeader`/`SheetTitle` (`@/components/ui/sheet`); `Button` (`@/components/ui/button`); `ReportBranchField`/`ReportDateRangeFields`, `ReportFieldOption` (`@/features/report/shared/report-filter-fields`); `EmployeeCombobox` (Task 7); `useEmployeeOptions` (Task 6).
- Produces: `EmployeeSalesFilterSheet` component and its `EmployeeSalesDraft` type export — consumed by Task 14 (page).

```ts
export interface EmployeeSalesDraft {
  branchUuid: string;
  loginUuid: string;
  dateFrom: string;
  dateTo: string;
}
```

- [ ] **Step 1: Write the component**

```tsx
// src/features/report/employee-sales/employee-sales-filter-sheet.tsx
"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReportBranchField, ReportDateRangeFields, type ReportFieldOption } from "@/features/report/shared/report-filter-fields";
import { EmployeeCombobox } from "./employee-combobox";
import { useEmployeeOptions } from "./use-employee-options";

export interface EmployeeSalesDraft {
  branchUuid: string;
  loginUuid: string;
  dateFrom: string;
  dateTo: string;
}

export function EmployeeSalesFilterSheet({
  open,
  onOpenChange,
  draft,
  draftBranch,
  onDraftChange,
  branchLoading,
  branchLocked,
  branchOptions,
  valid,
  dateRangeInvalid,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: EmployeeSalesDraft;
  draftBranch: string;
  onDraftChange: (updater: (previous: EmployeeSalesDraft) => EmployeeSalesDraft) => void;
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: ReportFieldOption[];
  valid: boolean;
  dateRangeInvalid: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const { options: employees, loading: employeesLoading } = useEmployeeOptions(draftBranch);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{t("report.filters.currentFilters")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6">
          <ReportBranchField
            id="employee-sales-branch"
            branchLoading={branchLoading}
            branchLocked={branchLocked}
            options={branchOptions}
            value={draftBranch}
            onValueChange={branchUuid => onDraftChange(previous => ({ ...previous, branchUuid, loginUuid: "" }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground" htmlFor="employee-sales-employee">
              {t("employeeSales.employee")}
            </label>
            <EmployeeCombobox
              disabled={!draftBranch}
              employees={employees}
              id="employee-sales-employee"
              loading={employeesLoading}
              value={draft.loginUuid}
              onValueChange={loginUuid => onDraftChange(previous => ({ ...previous, loginUuid }))}
            />
          </div>
          <ReportDateRangeFields
            idPrefix="employee-sales"
            dateFrom={draft.dateFrom}
            dateTo={draft.dateTo}
            onDateFromChange={dateFrom => onDraftChange(previous => ({ ...previous, dateFrom }))}
            onDateToChange={dateTo => onDraftChange(previous => ({ ...previous, dateTo }))}
          />
          {dateRangeInvalid && (
            <p className="text-sm text-destructive" role="alert">{t("employeeSales.invalidDateRange")}</p>
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
git add src/features/report/employee-sales/employee-sales-filter-sheet.tsx
git commit -m "$(cat <<'EOF'
Add filter sheet for employee sales branch/employee/date filters

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Create the toolbar

**Files:**
- Create: `src/features/report/employee-sales/employee-sales-toolbar.tsx`

**Interfaces:**
- Consumes: `Badge` (`@/components/ui/badge`), `Button` (`@/components/ui/button`); `ArrowDownIcon`/`ArrowUpIcon`/`RefreshCwIcon`/`SlidersHorizontalIcon` (`lucide-react`).
- Produces: `EmployeeSalesToolbar` component — consumed by Task 14 (page).

- [ ] **Step 1: Write the component**

```tsx
// src/features/report/employee-sales/employee-sales-toolbar.tsx
"use client";

import { ArrowDownIcon, ArrowUpIcon, RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function EmployeeSalesToolbar({
  filterCount,
  onOpenFilters,
  onRefresh,
  onToggleOrderBy,
  orderBy,
  refreshDisabled,
}: {
  filterCount: number;
  onOpenFilters: () => void;
  onRefresh: () => void;
  onToggleOrderBy: () => void;
  orderBy: "asc" | "desc";
  refreshDisabled: boolean;
}) {
  const { t } = useTranslation();
  const OrderByIcon = orderBy === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" className="min-h-10 gap-2" onClick={onOpenFilters}>
        <SlidersHorizontalIcon className="size-4" />
        {t("report.filters.openFilters")}
        {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="min-h-10 gap-2"
        aria-label={t("report.filters.orderBy")}
        onClick={onToggleOrderBy}
      >
        <OrderByIcon className="size-4" />
        {t("report.filters.orderBy")}
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
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/employee-sales/employee-sales-toolbar.tsx
git commit -m "$(cat <<'EOF'
Add toolbar with filter button, orderBy toggle, and refresh

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Create the desktop table

**Files:**
- Create: `src/features/report/employee-sales/employee-sales-table.tsx`

**Interfaces:**
- Consumes: `Badge` (`@/components/ui/badge`); `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` (`@/components/ui/table`); `money` (`@/lib/format`); `userInitials` (`@/features/settings/user/user-utils`); `Avatar`/`AvatarFallback`/`AvatarImage` (`@/components/ui/avatar`); `EmployeeSalesRow` type (`@/services/report`, Task 3).
- Produces: `EmployeeSalesTable` component — consumed by Task 14 (page). Visible only at `md` and up (`hidden md:block`); Task 12's card list is its `md:hidden` counterpart.

- [ ] **Step 1: Write the component**

```tsx
// src/features/report/employee-sales/employee-sales-table.tsx
"use client";

import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userInitials } from "@/features/settings/user/user-utils";
import { money } from "@/lib/format";
import type { EmployeeSalesRow } from "@/services/report";

export function EmployeeSalesTable({
  rows,
  onSelect,
}: {
  rows: EmployeeSalesRow[];
  onSelect: (loginUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="hidden shrink-0 overflow-hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("employeeSales.employee")}</TableHead>
            <TableHead>{t("employeeSales.billCount")}</TableHead>
            <TableHead>{t("employeeSales.totalQty")}</TableHead>
            <TableHead>{t("employeeSales.netSale")}</TableHead>
            <TableHead>{t("employeeSales.serviceCharge")}</TableHead>
            <TableHead>{t("employeeSales.vat")}</TableHead>
            <TableHead>{t("employeeSales.grandTotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.login_uuid} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(row.login_uuid)}>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
                    <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium" translate="no">{row.login_email}</p>
                    <p className="truncate text-muted-foreground">{row.roles_name}</p>
                  </div>
                  {row.cancel_summary.cancel_bill_count > 0 && (
                    <Badge variant="outline" className="border-warning/25 bg-warning/10 text-warning">
                      {t("employeeSales.cancelledBadge", { count: row.cancel_summary.cancel_bill_count })}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{row.summary.bill_count}</TableCell>
              <TableCell className="tabular-nums">{row.summary.total_qty}</TableCell>
              <TableCell className="tabular-nums">{money(row.summary.net_sale)}</TableCell>
              <TableCell className="tabular-nums">{money(row.summary.service_charge)}</TableCell>
              <TableCell className="tabular-nums">{money(row.summary.vat)}</TableCell>
              <TableCell className="font-medium tabular-nums">{money(row.summary.grand_total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

`Avatar` (`src/components/ui/avatar.tsx`) defaults to `size="default"` (`size-8`, 32px) when no `size` prop is passed — correct for a table row, so the code above intentionally omits the `size` prop rather than copying `UserAvatar`'s `size="lg"`.

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/employee-sales/employee-sales-table.tsx
git commit -m "$(cat <<'EOF'
Add desktop table for the employee sales report

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Create the mobile card list

**Files:**
- Create: `src/features/report/employee-sales/employee-sales-row-card.tsx`

**Interfaces:**
- Consumes: `Avatar`/`AvatarFallback`/`AvatarImage` (`@/components/ui/avatar`); `Badge` (`@/components/ui/badge`); `Card` (`@/components/ui/card`); `userInitials` (`@/features/settings/user/user-utils`); `money` (`@/lib/format`); `EmployeeSalesRow` type (`@/services/report`).
- Produces: `EmployeeSalesRowCard` component — consumed by Task 14 (page). Visible only below `md` (`md:hidden`), the counterpart to Task 11's table.

- [ ] **Step 1: Write the component**

```tsx
// src/features/report/employee-sales/employee-sales-row-card.tsx
"use client";

import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { userInitials } from "@/features/settings/user/user-utils";
import { money } from "@/lib/format";
import type { EmployeeSalesRow } from "@/services/report";

export function EmployeeSalesRowCard({
  rows,
  onSelect,
}: {
  rows: EmployeeSalesRow[];
  onSelect: (loginUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {rows.map(row => (
        <Card
          key={row.login_uuid}
          role="button"
          tabIndex={0}
          className="min-h-10 gap-2 px-4 py-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => onSelect(row.login_uuid)}
          onKeyDown={event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSelect(row.login_uuid);
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar>
              {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
              <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium" translate="no">{row.login_email}</p>
              <p className="truncate text-sm text-muted-foreground">{row.roles_name}</p>
            </div>
            {row.cancel_summary.cancel_bill_count > 0 && (
              <Badge variant="outline" className="shrink-0 border-warning/25 bg-warning/10 text-warning">
                {t("employeeSales.cancelledBadge", { count: row.cancel_summary.cancel_bill_count })}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <p className="text-muted-foreground">{t("employeeSales.billCount")}: <span className="text-foreground">{row.summary.bill_count}</span></p>
            <p className="text-muted-foreground">{t("employeeSales.totalQty")}: <span className="text-foreground">{row.summary.total_qty}</span></p>
            <p className="text-muted-foreground">{t("employeeSales.netSale")}: <span className="text-foreground">{money(row.summary.net_sale)}</span></p>
            <p className="font-medium">{t("employeeSales.grandTotal")}: {money(row.summary.grand_total)}</p>
          </div>
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
git add src/features/report/employee-sales/employee-sales-row-card.tsx
git commit -m "$(cat <<'EOF'
Add mobile card list for the employee sales report

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Create the detail sheet

**Files:**
- Create: `src/features/report/employee-sales/employee-sales-detail-sheet.tsx`

**Interfaces:**
- Consumes: `Accordion`/`AccordionContent`/`AccordionItem`/`AccordionTrigger` (`@/components/ui/accordion`); `Alert`/`AlertDescription` (`@/components/ui/alert`); `Avatar`/`AvatarFallback`/`AvatarImage` (`@/components/ui/avatar`); `Badge` (`@/components/ui/badge`); `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` (`@/components/ui/sheet`); `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` (`@/components/ui/table`); `userInitials` (`@/features/settings/user/user-utils`); `formatShortDate`, `money` (`@/lib/format`); `EmployeeSalesRow` type (`@/services/report`).
- Produces: `EmployeeSalesDetailSheet` component — consumed by Task 14 (page).

- [ ] **Step 1: Write the component**

```tsx
// src/features/report/employee-sales/employee-sales-detail-sheet.tsx
"use client";

import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userInitials } from "@/features/settings/user/user-utils";
import { formatShortDate, money } from "@/lib/format";
import type { EmployeeSalesRow } from "@/services/report";

export function EmployeeSalesDetailSheet({
  row,
  language,
  onOpenChange,
}: {
  row: EmployeeSalesRow | null;
  language: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {row && (
              <>
                <Avatar>
                  {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
                  <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate" translate="no">{row.login_email}</span>
              </>
            )}
          </SheetTitle>
        </SheetHeader>
        {row && (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <p className="text-sm text-muted-foreground">{row.roles_name} · {row.branch_name}</p>

            <div>
              <h3 className="mb-2 text-sm font-medium">{t("employeeSales.paymentSummary")}</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">{t("employeeSales.cash")}</dt><dd>{money(row.payment_summary.cash)}</dd></div>
                <div><dt className="text-muted-foreground">{t("employeeSales.transfer")}</dt><dd>{money(row.payment_summary.transfer)}</dd></div>
                <div><dt className="text-muted-foreground">{t("employeeSales.credit")}</dt><dd>{money(row.payment_summary.credit)}</dd></div>
                <div><dt className="text-muted-foreground">{t("employeeSales.paymentTotal")}</dt><dd className="font-medium">{money(row.payment_summary.payment_total)}</dd></div>
              </dl>
            </div>

            {row.order_channels.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">{t("employeeSales.orderChannels")}</h3>
                <div className="flex flex-wrap gap-2">
                  {row.order_channels.map(channel => (
                    <Badge key={channel.order_channel} variant="outline">
                      {channel.order_channel_name} · {channel.bill_count} · {money(channel.grand_total)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {row.cancel_summary.cancel_bill_count > 0 && (
              <Alert className="border-warning/45 bg-warning/10 text-warning">
                <AlertDescription className="text-warning/90">
                  {t("employeeSales.cancelSummaryDescription", {
                    count: row.cancel_summary.cancel_bill_count,
                    amount: money(row.cancel_summary.cancel_total_amount),
                  })}
                </AlertDescription>
              </Alert>
            )}

            <div>
              <h3 className="mb-2 text-sm font-medium">{t("employeeSales.orders")}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("employeeSales.invoice")}</TableHead>
                    <TableHead>{t("employeeSales.saleDate")}</TableHead>
                    <TableHead>{t("employeeSales.totalQty")}</TableHead>
                    <TableHead>{t("employeeSales.netSale")}</TableHead>
                    <TableHead>{t("employeeSales.serviceCharge")}</TableHead>
                    <TableHead>{t("employeeSales.vat")}</TableHead>
                    <TableHead>{t("employeeSales.grandTotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.orders.map(order => (
                    <TableRow key={order.order_uuid}>
                      <TableCell className="font-medium">{order.order_invoice}</TableCell>
                      <TableCell>{formatShortDate(order.sale_date, language)}</TableCell>
                      <TableCell className="tabular-nums">{order.total_qty}</TableCell>
                      <TableCell className="tabular-nums">{money(order.net_sale)}</TableCell>
                      <TableCell className="tabular-nums">{money(order.service_charge)}</TableCell>
                      <TableCell className="tabular-nums">{money(order.vat)}</TableCell>
                      <TableCell className="font-medium tabular-nums">{money(order.grand_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">{t("employeeSales.groups")}</h3>
              <Accordion type="multiple">
                {row.groups.map(group => (
                  <AccordionItem key={group.group_uuid} value={group.group_uuid}>
                    <AccordionTrigger>
                      <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                        <span>{group.group_name}</span>
                        <span className="text-muted-foreground">{group.total_qty} · {money(group.total_amount)}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("employeeSales.productName")}</TableHead>
                            <TableHead>{t("employeeSales.unitPrice")}</TableHead>
                            <TableHead>{t("employeeSales.totalQty")}</TableHead>
                            <TableHead>{t("employeeSales.totalAmount")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.items.map(item => (
                            <TableRow key={`${item.order_uuid}-${item.prod_uuid}`}>
                              <TableCell>{item.product_full_name}</TableCell>
                              <TableCell className="tabular-nums">{money(item.unit_price)}</TableCell>
                              <TableCell className="tabular-nums">{item.total_qty}</TableCell>
                              <TableCell className="tabular-nums">{money(item.total_amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
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
git add src/features/report/employee-sales/employee-sales-detail-sheet.tsx
git commit -m "$(cat <<'EOF'
Add employee detail sheet with payment, channels, orders, and category breakdown

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Create the page and wire everything together

**Files:**
- Create: `src/features/report/employee-sales/employee-sales-page.tsx`

**Interfaces:**
- Consumes: `EmployeeSalesToolbar` (Task 10), `EmployeeSalesFilterSheet` + `EmployeeSalesDraft` (Task 9), `EmployeeSalesTable` (Task 11), `EmployeeSalesRowCard` (Task 12), `EmployeeSalesDetailSheet` (Task 13), `EmployeeSalesSkeleton` (Task 8), `activeEmployeeSalesFilterCount` (Task 5), `useEmployeeSalesReportStore` (Task 4); plus `EmptyState` (`@/components/common/empty-state`), `Alert`/`AlertDescription` (`@/components/ui/alert`), `useReportBranchSelection` (`@/features/report/shared/use-report-branch-selection`), `authStoreUuid`/`useAuthStore` (`@/stores/auth-store`), `businessDateInputValue` (`@/lib/format`).
- Produces: `EmployeeSalesPage` component — consumed by Task 15 (route file). This is the only file the route imports.

- [ ] **Step 1: Write the page**

```tsx
// src/features/report/employee-sales/employee-sales-page.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { businessDateInputValue, money } from "@/lib/format";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useEmployeeSalesReportStore } from "@/stores/report-store";
import { EmployeeSalesDetailSheet } from "./employee-sales-detail-sheet";
import { EmployeeSalesFilterSheet, type EmployeeSalesDraft } from "./employee-sales-filter-sheet";
import { EmployeeSalesRowCard } from "./employee-sales-row-card";
import { EmployeeSalesSkeleton } from "./employee-sales-skeleton";
import { EmployeeSalesTable } from "./employee-sales-table";
import { EmployeeSalesToolbar } from "./employee-sales-toolbar";
import { activeEmployeeSalesFilterCount } from "./employee-sales-utils";

export function EmployeeSalesPage() {
  const user = useAuthStore(state => state.user);
  return <EmployeeSalesReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function isValidDateRange(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(from) && valid(to) && from <= to;
}

function EmployeeSalesReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useEmployeeSalesReportStore();
  const today = businessDateInputValue();
  const [draft, setDraft] = useState<EmployeeSalesDraft>(() => ({
    branchUuid: scope.defaultBranchUuid, loginUuid: "", dateFrom: today, dateTo: today,
  }));
  const [applied, setApplied] = useState(draft);
  const [orderBy, setOrderBy] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = isValidDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;

  useEffect(() => {
    if (!branchUuid) return;
    void load({
      branch_uuid_fk: branchUuid, login_uuid: applied.loginUuid || undefined,
      date_from: applied.dateFrom, date_to: applied.dateTo, lang: language, orderBy,
    }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.loginUuid, applied.dateFrom, applied.dateTo, orderBy, language]);

  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo ? report : null;
  const selected = current?.user_reports.find(row => row.login_uuid === selectedId) ?? null;
  const filterCount = activeEmployeeSalesFilterCount({ dateFrom: applied.dateFrom, dateTo: applied.dateTo, loginUuid: applied.loginUuid }, today);

  function apply() {
    if (!valid) return;
    setSelectedId(null);
    setApplied({ ...draft, branchUuid: draftBranch });
    setFilterSheetOpen(false);
  }

  function refresh() {
    setSelectedId(null);
    setApplied(previous => ({ ...previous }));
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background font-lao">
      <header className="flex shrink-0 flex-col gap-2 border-b p-3 md:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">{t("employeeSales.title")}</h1>
          <p className="text-sm text-muted-foreground">{scope.branchLabelFor(branchUuid)}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t("employeeSales.description")}</p>
        <EmployeeSalesToolbar
          filterCount={filterCount}
          onOpenFilters={() => setFilterSheetOpen(true)}
          onRefresh={refresh}
          onToggleOrderBy={() => setOrderBy(previous => (previous === "asc" ? "desc" : "asc"))}
          orderBy={orderBy}
          refreshDisabled={loading || !branchUuid}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
        {(error || scope.branchError) && <Alert variant="destructive"><AlertDescription>{error || scope.branchError}</AlertDescription></Alert>}
        {loading ? <EmployeeSalesSkeleton /> : current ? <>
          <p className="text-sm text-muted-foreground">
            {t("employeeSales.summaryLine", { employeeCount: current.summary.employee_count, billCount: current.summary.bill_count })}
            {" · "}{t("employeeSales.grandTotal")}: {money(current.summary.grand_total)}
          </p>
          {current.user_reports.length ? <>
            <EmployeeSalesTable rows={current.user_reports} onSelect={setSelectedId} />
            <EmployeeSalesRowCard rows={current.user_reports} onSelect={setSelectedId} />
          </> : <EmptyState title={t("employeeSales.empty")} description={t("employeeSales.emptyDescription")} />}
        </> : null}
      </div>

      <EmployeeSalesFilterSheet
        open={filterSheetOpen}
        onOpenChange={open => { if (!open) setDraft(applied); setFilterSheetOpen(open); }}
        draft={draft}
        draftBranch={draftBranch}
        onDraftChange={setDraft}
        branchLoading={scope.branchLoading}
        branchLocked={!scope.canSelectBranch}
        branchOptions={scope.branchOptions}
        valid={valid}
        dateRangeInvalid={!dateRangeValid}
        onApply={apply}
      />

      <EmployeeSalesDetailSheet
        row={selected}
        language={language}
        onOpenChange={open => { if (!open) setSelectedId(null); }}
      />
    </section>
  );
}
```

**Note for the implementer:** this page has no pagination UI because `EmployeeSalesResponse` carries no `pagination` field (unlike `order-audit`'s response) — the API returns every matching employee in one response, per the spec. Do not add pagination controls.

- [ ] **Step 2: Run typecheck and lint**

Run: `npm run typecheck`
Expected: no new errors (a pre-existing, unrelated error in `src/features/offline/offline-app-runtime.tsx`, if present, predates this feature — verify with `git log -1 -- src/features/offline/offline-app-runtime.tsx` before treating any typecheck failure as pre-existing; do not assume without checking).

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/report/employee-sales/employee-sales-page.tsx
git commit -m "$(cat <<'EOF'
Compose the employee sales report page from toolbar, filter sheet, table/card, and detail sheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Add the route file

**Files:**
- Create: `src/app/(protected)/report/employee-sales/page.tsx`

**Interfaces:**
- Consumes: `EmployeeSalesPage` from `@/features/report/employee-sales/employee-sales-page` (Task 14).

- [ ] **Step 1: Write the route file**

```tsx
// src/app/(protected)/report/employee-sales/page.tsx
import { EmployeeSalesPage } from "@/features/report/employee-sales/employee-sales-page";

export default function Page() {
  return <EmployeeSalesPage />;
}
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm test`
Run: `npm run build`
Expected: all four pass, confirming `/report/employee-sales` builds and every existing test (including the new `employee-sales-utils.test.ts` and the `i18n-resources.test.ts` parity check) stays green.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/report/employee-sales/page.tsx"
git commit -m "$(cat <<'EOF'
Add /report/employee-sales route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Manual browser verification

**Files:** none (verification only)

**Interfaces:** none — this task confirms Tasks 1–15 work together in the running app.

- [ ] **Step 1: Start the dev server and open the page**

Run: `npm run dev`
Open `http://localhost:3000/report/employee-sales` in the browser (this route sits under `(protected)` and requires a logged-in session — if no test account is available, ask the user to open it themselves and report back, same as the order-audit verification gap).

- [ ] **Step 2: Verify desktop behavior**

- Toolbar shows "Filter" button (with a numeric badge once the employee or date range differs from default), an orderBy toggle button, and a refresh icon button.
- Opening "Filter" shows branch, employee combobox (searchable, "All employees" pinned first), and date range in a right-side sheet.
- Changing branch in the sheet refetches the employee combobox's list for that branch and resets the selected employee if it no longer applies.
- Applying with an employee selected re-fetches and narrows the table to that one employee; leaving it as "All employees" shows every employee at the branch.
- The table renders one row per employee with avatar, email, role, bill/qty/net-sale/service-charge/vat/grand-total, and a warning-toned "N cancelled" badge only when that employee has cancellations.
- Clicking a row opens the detail sheet with payment summary, order channels, a cancel-summary alert (only when applicable), the orders table, and an expandable category-breakdown accordion with item-level tables.
- Toggling orderBy re-fetches with the opposite sort direction (verify via network tab: `orderBy=asc` vs `orderBy=desc`).

- [ ] **Step 3: Verify mobile/tablet behavior**

At a width below 768px (`md`):
- The table disappears and the card list appears instead, one card per employee.
- Tapping a card opens the same detail sheet, full-width.
- All buttons remain at least 40px tall.

- [ ] **Step 4: Verify empty, loading, and error states**

- Reload and confirm the table-shaped skeleton appears briefly.
- Pick a date range with no sales and confirm `EmptyState` renders.
- Confirm a branch-load failure still renders the destructive `Alert`.

No commit for this task — it is verification only. If any step fails, return to the relevant earlier task, fix, and re-commit there.
