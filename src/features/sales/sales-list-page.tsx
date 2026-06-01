"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Ban, CalendarClock, Check, ChevronLeft, ChevronRight, ReceiptText, RefreshCcw, SlidersHorizontal, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { dateTime, money } from "@/lib/format";
import { DEFAULT_PAGE_LIMIT, pageLimitNumber } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { CancelableBill, CancelableBillDetail, CancelableDateOption } from "@/services/cancel";
import type { ApiEntity, PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCancelStore } from "@/stores/cancel-store";
import { useToastStore } from "@/stores/toast-store";

type BillSource = CancelableBill | CancelableBillDetail | null | undefined;

const INITIAL_DATE_SELECT = "today";
const SALES_LIST_LIMIT_OPTIONS: number[] = [20, 50, 100, 200];
const orderOptions: SortOrder[] = ["DESC", "ASC"];

const invoiceKeys = ["order_invoice", "invoice_number", "invoice_no", "invoice", "bill_no", "order_no"];
const orderUuidKeys = ["order_uuid", "order_uuid_fk", "selected_order_uuid", "bill_uuid", "uuid", "id"];
const branchKeys = ["branch_name", "branch_name_la", "branch_name_eng"];
const tableKeys = ["table_name", "table_name_la", "table_name_eng", "table_no"];
const dateKeys = ["created_at", "order_date", "sale_date", "business_date", "date", "datetime_in", "updated_at"];
const totalKeys = ["order_grand_total", "grand_total", "sum_grand_total", "net_total", "total", "order_total", "amount"];
const statusKeys = ["status_name", "status_text", "order_status_text", "payment_status_text", "status", "order_status"];
const itemKeys = ["items", "details", "order_items", "bill_items", "products", "data"];
type BillNestedSection = "bill_discount" | "order" | "payment" | "self" | "service_charge" | "totals" | "vat";

function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecords(value: unknown): ApiEntity[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asRecord(value: unknown): ApiEntity | null {
  return isRecord(value) ? value : null;
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function textValue(value: unknown, fallback = "-") {
  return isPresent(value) ? String(value) : fallback;
}

function readValue(row: BillSource | ApiEntity, keys: string[]) {
  if (!isRecord(row)) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

function optionalNumber(value: unknown) {
  if (!isPresent(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = optionalNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function moneyOrDash(value: unknown) {
  const number = optionalNumber(value);
  return number === null ? "-" : money(number);
}

function percentLabel(value: unknown) {
  const number = optionalNumber(value);
  return number === null ? null : `${number.toLocaleString("lo-LA", { maximumFractionDigits: 2 })}%`;
}

function isTruthy(value: unknown) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function booleanField(source: BillSource, keys: string[]) {
  const value = readValue(source, keys);
  return isPresent(value) ? isTruthy(value) : null;
}

function nestedRecord(source: BillSource | ApiEntity, key: string) {
  return isRecord(source) ? asRecord(source[key]) : null;
}

function billSection(source: BillSource, section: BillNestedSection) {
  if (!isRecord(source)) return null;
  return section === "self" ? source : nestedRecord(source, section);
}

function readFromBillSections(sources: BillSource[], keys: string[], sections: BillNestedSection[]) {
  for (const source of sources) {
    for (const section of sections) {
      const value = readValue(billSection(source, section), keys);
      if (isPresent(value)) return value;
    }
  }
  return undefined;
}

function numberFromBillSections(sources: BillSource[], keys: string[], sections: BillNestedSection[]) {
  return optionalNumber(readFromBillSections(sources, keys, sections));
}

function billUuid(source: BillSource) {
  return textValue(readFromBillSections([source], orderUuidKeys, ["order", "self"]), "");
}

function billInvoice(...sources: BillSource[]) {
  return textValue(readFromBillSections(sources, invoiceKeys, ["order", "self"]), "-");
}

function billBranch(...sources: BillSource[]) {
  return textValue(readFromBillSections(sources, branchKeys, ["order", "self"]), "-");
}

function billTable(...sources: BillSource[]) {
  return textValue(readFromBillSections(sources, tableKeys, ["order", "self"]), "-");
}

function billDate(...sources: BillSource[]) {
  return dateTime(textValue(readFromBillSections(sources, dateKeys, ["order", "self"]), ""));
}

function billTotal(...sources: BillSource[]) {
  const value = numberFromBillSections(sources, totalKeys, ["totals", "self", "order"]);
  return value === null ? "-" : money(value);
}

function billStatus(...sources: BillSource[]) {
  return textValue(readFromBillSections(sources, statusKeys, ["order", "self"]), "-");
}

function billCanCancel(...sources: BillSource[]) {
  for (const source of sources) {
    for (const section of ["order", "self"] as const) {
      const record = billSection(source, section);
      const value = booleanField(record, ["can_cancel"]);
      if (value !== null) return value;
    }
  }
  return false;
}

function billIsSelected(source: BillSource, selectedOrderUuid: string) {
  return Boolean(booleanField(source, ["is_selected"]) || (selectedOrderUuid && billUuid(source) === selectedOrderUuid));
}

function billItems(source: BillSource) {
  if (!isRecord(source)) return [];
  for (const key of itemKeys) {
    const rows = asRecords(source[key]);
    if (rows.length) return rows;
  }
  return [];
}

function itemName(item: ApiEntity) {
  return textValue(readValue(item, ["prod_name", "product_name", "name", "title", "item_name"]), "-");
}

function itemQty(item: ApiEntity) {
  return textValue(readValue(item, ["qty", "quantity", "order_it_qty", "sale_qty"]), "-");
}

function itemPrice(item: ApiEntity) {
  const value = optionalNumber(readValue(item, ["price", "unit_price", "base_price", "pro_detail_sprice"]));
  return value === null ? "-" : money(value);
}

function itemTotal(item: ApiEntity) {
  const value = optionalNumber(readValue(item, ["line_total", "net_total", "total", "gross_total", "base_line_total"]));
  return value === null ? "-" : money(value);
}

function itemStatus(item: ApiEntity) {
  return textValue(readValue(item, statusKeys), "-");
}

function itemSize(item: ApiEntity) {
  return textValue(readValue(item, ["size_name", "size_name_la", "size_name_eng", "size"]), "");
}

function itemNote(item: ApiEntity) {
  return textValue(readValue(item, ["note", "order_it_note", "item_note"]), "");
}

function itemCashier(item: ApiEntity) {
  return textValue(readValue(item, ["cashier_name", "cashier", "user_name", "login_name"]), "");
}

function itemToppings(item: ApiEntity) {
  return asRecords(readValue(item, ["toppings", "item_toppings", "order_item_toppings"]));
}

function itemToppingTotal(item: ApiEntity) {
  const explicit = optionalNumber(readValue(item, ["topping_unit_total", "topping_total", "topping_line_total"]));
  if (explicit !== null) return explicit;
  const toppings = itemToppings(item);
  if (!toppings.length) return null;
  return toppings.reduce((sum, topping) => sum + (optionalNumber(readValue(topping, ["topping_total", "total", "line_total", "topping_price"])) ?? 0), 0);
}

function itemDiscountRecord(item: ApiEntity) {
  return nestedRecord(item, "item_discount") ?? nestedRecord(item, "discount");
}

function itemDiscountAmount(item: ApiEntity) {
  const discount = itemDiscountRecord(item);
  return firstNumber(readValue(discount, ["amount", "discount_amount"]), readValue(item, ["item_discount_amount", "order_it_discount_amount", "discount_amount"]));
}

function discountLabel(discount: ApiEntity | null, fallback = "") {
  const type = textValue(readValue(discount, ["type", "discount_type"]), "").toUpperCase();
  const value = readValue(discount, ["value", "discount_value"]);
  const rate = type === "PCT" ? percentLabel(value) : null;
  if (rate) return fallback ? `${fallback} (${rate})` : rate;
  const fixed = type && value ? moneyOrDash(value) : "";
  return fixed && fallback ? `${fallback} (${fixed})` : fallback || fixed;
}

function billNumber(bill: BillSource, keys: string[], sections: BillNestedSection[]) {
  return numberFromBillSections([bill], keys, sections);
}

function billDiscountAmount(bill: BillSource) {
  return firstNumber(
    readFromBillSections([bill], ["amount", "discount_amount"], ["bill_discount"]),
    readFromBillSections([bill], ["bill_discount_amount", "order_discount_amount", "discount_amount"], ["totals", "self", "order"])
  );
}

function billDiscountLabel(bill: BillSource, fallback: string) {
  return discountLabel(billSection(bill, "bill_discount"), fallback);
}

function billRateLabel(bill: BillSource, section: "service_charge" | "vat") {
  return percentLabel(readFromBillSections([bill], ["rate", "vat_rate", "service_rate"], [section]));
}

function billItemsDiscountTotal(bill: BillSource) {
  const explicit = billNumber(bill, ["item_discount_amount", "order_item_discount_amount"], ["totals", "self", "order"]);
  if (explicit !== null) return explicit;
  const items = billItems(bill);
  if (!items.length) return null;
  return items.reduce((sum, item) => sum + (itemDiscountAmount(item) ?? 0), 0);
}

function statusClass(source: BillSource) {
  const status = billStatus(source).toLowerCase();
  if (status.includes("cancel") || status.includes("void") || status === "0") {
    return "border-destructive/25 bg-destructive/10 text-destructive";
  }
  if (status.includes("paid") || status.includes("success") || status.includes("active") || status === "1") {
    return "border-primary/20 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

function statusDotClass(source: BillSource) {
  const status = billStatus(source).toLowerCase();
  if (status.includes("cancel") || status.includes("void") || status === "0") return "bg-destructive";
  if (status.includes("paid") || status.includes("success") || status.includes("active") || status === "1") return "bg-primary";
  return billCanCancel(source) ? "bg-primary" : "bg-muted-foreground";
}

function dateOptionValue(option: CancelableDateOption) {
  return textValue(readValue(option, ["date_select", "value", "key", "code", "id"]), "");
}

function dateOptionLabel(option: CancelableDateOption) {
  return textValue(readValue(option, ["label", "name", "title", "text", "date_label"]), dateOptionValue(option));
}

function pageBounds(page: number, limit: PageLimit, rowCount: number, total: number) {
  const size = pageLimitNumber(limit);
  const start = rowCount ? (page - 1) * size + 1 : 0;
  return { start, end: rowCount ? Math.min(total || start + rowCount - 1, start + rowCount - 1) : 0 };
}

function shouldOpenMobileDetail() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function SalesListPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const bills = useCancelStore((state) => state.bills);
  const dateOptions = useCancelStore((state) => state.dateOptions);
  const loading = useCancelStore((state) => state.loading);
  const detailLoading = useCancelStore((state) => state.detailLoading);
  const cancelling = useCancelStore((state) => state.cancelling);
  const error = useCancelStore((state) => state.error);
  const selectedBill = useCancelStore((state) => state.selectedBill);
  const total = useCancelStore((state) => state.total);
  const totalPages = useCancelStore((state) => state.totalPages);
  const loadBills = useCancelStore((state) => state.load);
  const cancelBill = useCancelStore((state) => state.cancelBill);
  const clearSelectedBill = useCancelStore((state) => state.clearSelectedBill);
  const resetBills = useCancelStore((state) => state.reset);
  const showToast = useToastStore((state) => state.show);
  const branchUuid = user?.branch_uuid ?? "";

  const [dateSelect, setDateSelect] = useState(INITIAL_DATE_SELECT);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_PAGE_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("DESC");
  const [page, setPage] = useState(1);
  const [selectedOrderUuid, setSelectedOrderUuid] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);

  const selectedListBill = useMemo(
    () => bills.find((bill) => billIsSelected(bill, selectedOrderUuid) || billUuid(bill) === selectedOrderUuid),
    [bills, selectedOrderUuid]
  );
  const detailSource = selectedBill ?? selectedListBill ?? null;
  const detailCanCancel = billCanCancel(selectedBill, selectedListBill);
  const cancelOrderUuid = billUuid(detailSource);
  const rowsRange = pageBounds(page, limit, bills.length, total);
  const safeTotalPages = Math.max(1, totalPages);
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < safeTotalPages && !loading;
  const reasonInvalid = reasonTouched && !cancelReason.trim();

  const safeDateOptions = useMemo<CancelableDateOption[]>(() => {
    const options = dateOptions.length ? dateOptions : [{ date_select: INITIAL_DATE_SELECT, label: t("salesList.today") }];
    const selectedExists = options.some((option) => dateOptionValue(option) === dateSelect);
    return selectedExists ? options : [{ date_select: dateSelect, label: dateSelect }, ...options];
  }, [dateOptions, dateSelect, t]);

  const load = useCallback(
    async (nextSelectedOrderUuid = selectedOrderUuid) => {
      if (!branchUuid) {
        resetBills();
        return;
      }
      try {
        await loadBills({
          branch_uuid_fk: branchUuid,
          date_select: dateSelect,
          lang: language,
          limit,
          orderBy,
          page,
          selected_order_uuid: nextSelectedOrderUuid || undefined
        });
      } catch (loadError) {
        showToast({
          title: t("salesList.loadFailed"),
          description: loadError instanceof Error ? loadError.message : "",
          tone: "error"
        });
      }
    },
    [branchUuid, dateSelect, language, limit, loadBills, orderBy, page, resetBills, selectedOrderUuid, showToast, t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && page > safeTotalPages) setPage(safeTotalPages);
  }, [loading, page, safeTotalPages]);

  function resetSelection() {
    setMobileDetailOpen(false);
    setSelectedOrderUuid("");
    clearSelectedBill();
  }

  function updateDate(value: string) {
    setDateSelect(value);
    setPage(1);
    resetSelection();
  }

  function updateLimit(value: string) {
    setLimit(Number(value));
    setPage(1);
    resetSelection();
  }

  function updateOrder(value: SortOrder) {
    setOrderBy(value);
    setPage(1);
    resetSelection();
  }

  function selectBill(bill: CancelableBill) {
    const uuid = billUuid(bill);
    if (!uuid) return;
    setSelectedOrderUuid(uuid);
    setMobileDetailOpen(shouldOpenMobileDetail());
  }

  function openCancelDialog() {
    if (!cancelOrderUuid || !detailCanCancel) return;
    setCancelReason("");
    setReasonTouched(false);
    setCancelOpen(true);
  }

  async function submitCancel() {
    setReasonTouched(true);
    const reason = cancelReason.trim();
    if (!cancelOrderUuid || !reason || cancelling) return;

    try {
      await cancelBill({ order_uuid: cancelOrderUuid, order_cancel_reason: reason });
      showToast({ title: t("salesList.cancelSuccess"), tone: "success" });
      setCancelOpen(false);
      setCancelReason("");
      setReasonTouched(false);
      resetSelection();
      await load("");
      const nextTotalPages = useCancelStore.getState().totalPages;
      if (page > nextTotalPages) setPage(Math.max(1, nextTotalPages));
    } catch (cancelError) {
      showToast({
        title: t("salesList.cancelFailed"),
        description: cancelError instanceof Error ? cancelError.message : "",
        tone: "error"
      });
    }
  }

  if (!branchUuid) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <SalesListHeader loading={false} onRefresh={() => undefined} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <EmptyState title={t("salesList.branchRequired")} description={t("salesList.branchRequiredDescription")} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <SalesListHeader loading={loading || detailLoading} onRefresh={() => void load()} />
      <div className="grid min-h-0 flex-1 gap-3 px-3 pb-3 md:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)] lg:px-5 lg:pb-5">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <SalesListToolbar
            dateOptions={safeDateOptions}
            dateSelect={dateSelect}
            limit={limit}
            orderBy={orderBy}
            onDateChange={updateDate}
            onLimitChange={updateLimit}
            onOrderChange={updateOrder}
          />
          <SalesListContent
            bills={bills}
            error={error}
            loading={loading}
            selectedOrderUuid={selectedOrderUuid}
            onSelect={selectBill}
          />
          <SalesListPaginationFooter
            canGoBack={canGoBack}
            canGoNext={canGoNext}
            loading={loading}
            page={page}
            pageEnd={rowsRange.end}
            pageStart={rowsRange.start}
            total={total}
            totalPages={safeTotalPages}
            onBack={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(safeTotalPages, current + 1))}
          />
        </section>

        <SalesBillDetailPanel
          bill={detailSource}
          canCancel={detailCanCancel}
          loading={detailLoading}
          onCancel={openCancelDialog}
        />
      </div>

      <SalesBillMobileSheet
        bill={detailSource}
        canCancel={detailCanCancel}
        loading={detailLoading}
        open={mobileDetailOpen}
        onCancel={openCancelDialog}
        onOpenChange={setMobileDetailOpen}
      />

      <CancelBillDialog
        bill={detailSource}
        cancelling={cancelling}
        open={cancelOpen}
        reason={cancelReason}
        reasonInvalid={reasonInvalid}
        onOpenChange={setCancelOpen}
        onReasonBlur={() => setReasonTouched(true)}
        onReasonChange={setCancelReason}
        onSubmit={() => void submitCancel()}
      />
    </div>
  );
}

function SalesListHeader({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden size-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary sm:flex">
          <ReceiptText />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase text-muted-foreground">{t("nav.sales")}</div>
          <h1 className="truncate text-xl font-black leading-tight">{t("salesList.title")}</h1>
          <p className="hidden max-w-2xl truncate text-xs text-muted-foreground md:block">{t("salesList.subtitle")}</p>
        </div>
      </div>
      <Button disabled={loading} size="sm" type="button" variant="outline" onClick={onRefresh}>
        {loading ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
        {t("actions.refresh")}
      </Button>
    </div>
  );
}

function SalesListToolbar({
  dateOptions,
  dateSelect,
  limit,
  orderBy,
  onDateChange,
  onLimitChange,
  onOrderChange
}: {
  dateOptions: CancelableDateOption[];
  dateSelect: string;
  limit: PageLimit;
  orderBy: SortOrder;
  onDateChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onOrderChange: (value: SortOrder) => void;
}) {
  const { t } = useTranslation();
  const filterLabel = t("settings.filterTitle");

  function renderDateSelect(id: string, triggerClassName: string) {
    return (
      <Select value={dateSelect} onValueChange={onDateChange}>
        <SelectTrigger id={id} aria-label={t("salesList.dateFilter")} className={cn("w-full font-semibold", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {dateOptions.map((option) => {
              const value = dateOptionValue(option);
              return value ? (
                <SelectItem key={value} value={value}>
                  {dateOptionLabel(option)}
                </SelectItem>
              ) : null;
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  function renderLimitSelect(id: string, triggerClassName: string) {
    return (
      <Select value={String(limit)} onValueChange={onLimitChange}>
        <SelectTrigger id={id} aria-label={t("common.rowsPerPage")} className={cn("w-full font-semibold", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {SALES_LIST_LIMIT_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  function renderOrderSelect(id: string, triggerClassName: string) {
    return (
      <Select value={String(orderBy)} onValueChange={(value) => onOrderChange(value as SortOrder)}>
        <SelectTrigger id={id} aria-label={t("common.order")} className={cn("w-full font-semibold", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {orderOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`common.${option.toLowerCase()}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="shrink-0 border-b border-border bg-card px-3 py-2.5 sm:px-4 lg:px-5">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2 lg:hidden">
        {renderDateSelect("sales-list-mobile-date", "h-10")}
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label={filterLabel} className="size-10 px-0" type="button" variant="outline">
              <SlidersHorizontal />
            </Button>
          </SheetTrigger>
          <SheetContent className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-lg p-0" side="bottom">
            <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
              <SheetTitle>{filterLabel}</SheetTitle>
              <SheetDescription>{t("settings.filterDescription")}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 overflow-y-auto px-4 py-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="sales-list-mobile-limit">{t("common.rowsPerPage")}</FieldLabel>
                {renderLimitSelect("sales-list-mobile-limit", "h-11")}
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="sales-list-mobile-order">{t("common.order")}</FieldLabel>
                {renderOrderSelect("sales-list-mobile-order", "h-11")}
              </Field>
            </div>
            <SheetFooter className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  {t("actions.cancel")}
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button type="button">
                  <Check data-icon="inline-start" />
                  {t("actions.apply")}
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden w-full min-w-0 items-center gap-2 lg:flex">
        <div className="w-[18rem] max-w-full flex-none xl:w-[20rem]">{renderDateSelect("sales-list-desktop-date", "h-8")}</div>
        <div className="ml-auto w-28 flex-none">{renderLimitSelect("sales-list-desktop-limit", "h-8")}</div>
        <div className="w-28 flex-none">{renderOrderSelect("sales-list-desktop-order", "h-8")}</div>
      </div>
    </div>
  );
}

function SalesListPaginationFooter({
  canGoBack,
  canGoNext,
  loading,
  onBack,
  onNext,
  page,
  pageEnd,
  pageStart,
  total,
  totalPages
}: {
  canGoBack: boolean;
  canGoNext: boolean;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  page: number;
  pageEnd: number;
  pageStart: number;
  total: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{t("common.showingRange", { start: pageStart, end: pageEnd, total })}</span>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
        <Button className="min-w-0" disabled={!canGoBack || loading} size="xs" type="button" variant="outline" onClick={onBack}>
          <ChevronLeft data-icon="inline-start" />
          {t("actions.back")}
        </Button>
        <Badge className="h-7 px-2 text-xs tabular-nums">
          {t("common.page", { current: page, total: totalPages })}
        </Badge>
        <Button className="min-w-0" disabled={!canGoNext || loading} size="xs" type="button" variant="outline" onClick={onNext}>
          {t("common.nextPage")}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}

function SalesListContent({
  bills,
  error,
  loading,
  selectedOrderUuid,
  onSelect
}: {
  bills: CancelableBill[];
  error: string | null;
  loading: boolean;
  selectedOrderUuid: string;
  onSelect: (bill: CancelableBill) => void;
}) {
  const { t } = useTranslation();

  if (loading) return <SalesListSkeleton />;

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      {error ? (
        <div className="p-3">
          <Alert variant="destructive">
            <AlertTitle>{t("salesList.loadFailed")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {bills.length ? (
        <SalesBillCardList bills={bills} selectedOrderUuid={selectedOrderUuid} onSelect={onSelect} />
      ) : (
        <div className="flex min-h-72 items-center justify-center p-4">
          <EmptyState title={t("salesList.noBills")} description={t("salesList.noBillsDescription")} />
        </div>
      )}
    </div>
  );
}

function SalesBillCardList({
  bills,
  selectedOrderUuid,
  onSelect
}: {
  bills: CancelableBill[];
  selectedOrderUuid: string;
  onSelect: (bill: CancelableBill) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="h-full min-h-0 overflow-y-auto p-2 sm:p-3">
      <div aria-label={t("salesList.title")} className="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-2 pb-3 xl:gap-3" role="listbox">
        {bills.map((bill) => (
          <SalesBillCard
            key={billUuid(bill) || billInvoice(bill)}
            bill={bill}
            selected={billIsSelected(bill, selectedOrderUuid)}
            onSelect={() => onSelect(bill)}
          />
        ))}
      </div>
    </div>
  );
}

function SalesBillCard({
  bill,
  selected,
  onSelect
}: {
  bill: CancelableBill;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const invoice = billInvoice(bill);

  return (
    <Card
      aria-selected={selected}
      className={cn(
        "relative overflow-hidden rounded-lg bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md",
        selected && "border-primary/60 ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      data-state={selected ? "selected" : undefined}
      role="option"
    >
      {selected ? (
        <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 size-12 overflow-hidden">
          <div className="absolute -left-6 -top-6 size-12 rotate-45 bg-primary" />
          <Check className="absolute left-1 top-1 text-primary-foreground" />
        </div>
      ) : null}
      <Button
        aria-pressed={selected}
        className="h-full min-h-[156px] w-full items-stretch justify-start rounded-none p-0 text-left hover:bg-transparent sm:min-h-[172px]"
        type="button"
        variant="ghost"
        onClick={onSelect}
      >
        <CardContent className="flex min-w-0 flex-1 flex-col p-0">
          <div className="relative flex min-h-[94px] flex-1 flex-col items-center justify-center px-4 py-4 text-center sm:min-h-[104px]">
            <span aria-hidden="true" className={cn("absolute right-3 top-3 size-3 rounded-full border-[3px] border-background shadow-sm", statusDotClass(bill))} />
            <p className="text-xs font-black uppercase leading-none text-muted-foreground">{t("salesList.invoice")}</p>
            <p className="mt-2 max-w-full truncate text-[28px] font-black leading-none tracking-normal text-foreground tabular-nums sm:text-[34px]">
              {invoice}
            </p>
            <p className="mt-2 max-w-full truncate text-xs font-semibold text-muted-foreground">
              {billTable(bill)} / {billDate(bill)}
            </p>
          </div>

          <div className="grid grid-cols-2 border-t border-border bg-muted/45 text-xs">
            <BillCardMetric className="border-b border-r border-border" icon={<Table2 />} label={t("salesList.table")} value={billTable(bill)} />
            <BillCardMetric className="border-b border-border" icon={<CalendarClock />} label={t("salesList.date")} value={billDate(bill)} valueClassName="tabular-nums" />
            <BillCardMetric className="border-r border-border" icon={<KipIcon />} label={t("salesList.total")} value={billTotal(bill)} valueClassName="font-black tabular-nums" />
            <div className="flex min-h-9 min-w-0 items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-muted-foreground">{t("salesList.cancelable")}</span>
              <span className="shrink-0">
                <CancelableBadge canCancel={billCanCancel(bill)} compact />
              </span>
            </div>
          </div>
        </CardContent>
      </Button>
    </Card>
  );
}

function BillCardMetric({
  className,
  icon,
  label,
  value,
  valueClassName
}: {
  className?: string;
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className={cn("flex min-h-9 min-w-0 items-center gap-2 px-3 py-2", className)}>
      <span aria-hidden="true" className="shrink-0 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <span className={cn("min-w-0 truncate font-bold", valueClassName)}>{value}</span>
    </div>
  );
}

function KipIcon() {
  return (
    <span aria-hidden="true" className="inline-flex size-4 items-center justify-center text-sm font-black leading-none">
      â‚­
    </span>
  );
}

function SalesBillDetailPanel({
  bill,
  canCancel,
  loading,
  onCancel
}: {
  bill: BillSource;
  canCancel: boolean;
  loading: boolean;
  onCancel: () => void;
}) {
  return (
    <aside className="hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card md:flex">
      <SalesBillDetailContent bill={bill} canCancel={canCancel} loading={loading} onCancel={onCancel} />
    </aside>
  );
}

function SalesBillMobileSheet({
  bill,
  canCancel,
  loading,
  open,
  onCancel,
  onOpenChange
}: {
  bill: BillSource;
  canCancel: boolean;
  loading: boolean;
  open: boolean;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-lg p-0 md:hidden">
        <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle>{bill ? billInvoice(bill) : t("salesList.billDetail")}</SheetTitle>
          <SheetDescription>{bill ? billDate(bill) : t("salesList.selectBillHint")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto">
          <SalesBillDetailContent bill={bill} canCancel={canCancel} loading={loading} onCancel={onCancel} embedded />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SalesBillDetailContent({
  bill,
  canCancel,
  embedded = false,
  loading,
  onCancel
}: {
  bill: BillSource;
  canCancel: boolean;
  embedded?: boolean;
  loading: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  if (loading) return <SalesDetailSkeleton />;

  if (!bill) {
    return (
      <div className="flex min-h-72 flex-1 items-center justify-center p-4">
        <EmptyState title={t("salesList.noSelection")} description={t("salesList.selectBillHint")} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("shrink-0 px-4 py-3", !embedded && "border-b border-border")}>
        <DetailTitleRow bill={bill} canCancel={canCancel} loading={loading} onCancel={onCancel} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
        <DetailSummaryStrip bill={bill} />
        <Separator className="my-4" />
        <DetailItemsReceipt bill={bill} />
        <Separator className="my-4" />
        <DetailTotals bill={bill} />
        <Separator className="my-4" />
        <DetailPayment bill={bill} />
      </div>
    </div>
  );
}

function DetailTitleRow({
  bill,
  canCancel,
  loading,
  onCancel
}: {
  bill: BillSource;
  canCancel: boolean;
  loading: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const branch = billBranch(bill);
  const date = billDate(bill);
  const grandTotal = billTotal(bill);
  const table = billTable(bill);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge className={statusClass(bill)}>{billStatus(bill)}</Badge>
            <CancelableBadge canCancel={canCancel} compact />
          </div>
          <h2 className="mt-2 truncate text-xl font-black leading-tight tabular-nums">{billInvoice(bill)}</h2>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {table} / {date}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{branch}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold uppercase text-muted-foreground">{t("salesList.grandTotal")}</p>
          <p className="mt-1 whitespace-nowrap text-lg font-black tabular-nums">{grandTotal}</p>
        </div>
      </div>
      <Button className="w-full shrink-0" disabled={!bill || !canCancel || loading} size="sm" type="button" variant="danger" onClick={onCancel}>
        <Ban data-icon="inline-start" />
        {t("salesList.cancelBill")}
      </Button>
    </div>
  );
}

function DetailSummaryStrip({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const itemQtyTotal = billItems(bill).reduce((sum, item) => sum + (optionalNumber(readValue(item, ["qty", "quantity", "order_it_qty"])) ?? 0), 0);
  const orderQty = firstNumber(billNumber(bill, ["order_qty", "qty", "quantity"], ["totals", "self", "order"]), itemQtyTotal);
  const orderTotal = billNumber(bill, ["order_total", "total"], ["totals", "self", "order"]);
  const paidTotal = billNumber(bill, ["paid_total", "order_paid_total"], ["payment", "self", "order"]);
  const balance = billNumber(bill, ["balance", "order_balance", "debt_amount"], ["payment", "self", "order"]);

  return (
    <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-muted/35 text-sm">
      <DetailStat label={t("salesList.orderQty")} value={String(orderQty ?? "-")} />
      <DetailStat label={t("salesList.total")} value={moneyOrDash(orderTotal)} />
      <DetailStat label={t("salesList.paidTotal")} value={moneyOrDash(paidTotal)} />
      <DetailStat label={t("common.balance")} value={moneyOrDash(balance)} />
    </div>
  );
}

function DetailStat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-r border-border px-3 py-2 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-black tabular-nums">{value}</p>
    </div>
  );
}

function DetailItemsReceipt({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const items = billItems(bill);

  return (
    <section className="flex flex-col gap-2">
      <DetailSectionTitle>{t("salesList.items")}</DetailSectionTitle>
      {items.length ? (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border">
          {items.map((item, index) => (
            <DetailItemLine key={`${itemName(item)}-${index}`} item={item} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState title={t("salesList.noItems")} description={t("salesList.noItemsDescription")} />
      )}
    </section>
  );
}

function DetailItemLine({ item, index }: { item: ApiEntity; index: number }) {
  const { t } = useTranslation();
  const cashier = itemCashier(item);
  const discount = itemDiscountRecord(item);
  const discountAmount = itemDiscountAmount(item);
  const discountText = discountLabel(discount, t("salesList.itemDiscount"));
  const note = itemNote(item);
  const size = itemSize(item);
  const toppings = itemToppings(item);
  const toppingTotal = itemToppingTotal(item);

  return (
    <div className={cn("flex flex-col gap-2 px-3 py-3", index > 0 && "border-t border-border")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black">{itemName(item)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {size ? <span>{t("salesList.size")}: {size}</span> : null}
            <span>{itemQty(item)} x {itemPrice(item)}</span>
            <Badge className={statusClass(item)}>{itemStatus(item)}</Badge>
          </div>
        </div>
        <p className="shrink-0 text-right text-sm font-black tabular-nums">{itemTotal(item)}</p>
      </div>

      {discountAmount && discountAmount > 0 ? <ReceiptSubRow label={discountText} value={`-${money(discountAmount)}`} tone="destructive" /> : null}
      {toppingTotal && toppingTotal > 0 ? <ReceiptSubRow label={t("salesList.toppings")} value={`+${money(toppingTotal)}`} /> : null}
      {toppings.length ? (
        <div className="flex flex-col gap-1 rounded-md bg-muted/45 px-2 py-2 text-xs">
          {toppings.map((topping, toppingIndex) => {
            const name = textValue(readValue(topping, ["topping_name", "prod_topping_name", "product_name", "name"]), `${t("salesList.toppings")} ${toppingIndex + 1}`);
            const qty = textValue(readValue(topping, ["topping_qty", "qty", "quantity"]), "1");
            const total = moneyOrDash(readValue(topping, ["topping_total", "total", "line_total", "topping_price"]));
            return (
              <div key={`${name}-${toppingIndex}`} className="flex min-w-0 justify-between gap-3">
                <span className="min-w-0 truncate text-muted-foreground">+ {name} x {qty}</span>
                <span className="shrink-0 font-semibold tabular-nums">{total}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {note ? <ReceiptSubRow label={t("salesList.note")} value={note} /> : null}
      {cashier ? <ReceiptSubRow label={t("salesList.cashier")} value={cashier} /> : null}
    </div>
  );
}

function ReceiptSubRow({ label, tone, value }: { label: ReactNode; tone?: "destructive"; value: ReactNode }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 text-xs">
      <span className={cn("min-w-0 truncate text-muted-foreground", tone === "destructive" && "text-destructive")}>{label}</span>
      <span className={cn("shrink-0 font-semibold tabular-nums", tone === "destructive" && "text-destructive")}>{value}</span>
    </div>
  );
}

function DetailTotals({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const billDiscount = billDiscountAmount(bill);
  const grandTotal = billNumber(bill, totalKeys, ["totals", "self", "order"]);
  const itemDiscount = billItemsDiscountTotal(bill);
  const orderTotal = billNumber(bill, ["order_total", "total"], ["totals", "self", "order"]);
  const service = billNumber(bill, ["amount", "service_charge_amount", "order_service_amount", "service_amount"], ["service_charge", "totals", "self", "order"]);
  const serviceRate = billRateLabel(bill, "service_charge");
  const subtotal = billNumber(bill, ["order_subtotal", "subtotal"], ["totals", "self", "order"]);
  const vat = billNumber(bill, ["amount", "vat_amount", "order_vat_amount", "vat_total"], ["vat", "totals", "self", "order"]);
  const vatRate = billRateLabel(bill, "vat");

  return (
    <section className="flex flex-col gap-2">
      <DetailSectionTitle>{t("salesList.billBreakdown")}</DetailSectionTitle>
      <div className="overflow-hidden rounded-lg border border-border">
        <ReceiptTotalRow label={t("salesList.total")} value={moneyOrDash(orderTotal)} />
        {itemDiscount && itemDiscount > 0 ? <ReceiptTotalRow label={t("salesList.itemDiscount")} value={`-${money(itemDiscount)}`} tone="destructive" /> : null}
        <ReceiptTotalRow label={t("salesList.subtotal")} value={moneyOrDash(subtotal)} />
        {billDiscount && billDiscount > 0 ? <ReceiptTotalRow label={billDiscountLabel(bill, t("salesList.billDiscount"))} value={`-${money(billDiscount)}`} tone="destructive" /> : null}
        {service && service > 0 ? <ReceiptTotalRow label={serviceRate ? `${t("salesList.serviceCharge")} (${serviceRate})` : t("salesList.serviceCharge")} value={money(service)} /> : null}
        {vat && vat > 0 ? <ReceiptTotalRow label={vatRate ? `${t("salesList.vat")} (${vatRate})` : t("salesList.vat")} value={money(vat)} /> : null}
        <ReceiptTotalRow emphasis label={t("salesList.grandTotal")} value={moneyOrDash(grandTotal)} />
      </div>
    </section>
  );
}

function DetailPayment({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const balance = billNumber(bill, ["balance", "order_balance"], ["payment", "self", "order"]);
  const cash = billNumber(bill, ["receive_cash", "cash_received", "cash"], ["payment", "self"]);
  const change = billNumber(bill, ["change_amount", "change"], ["payment", "self"]);
  const debt = billNumber(bill, ["debt_amount", "debt"], ["payment", "self"]);
  const paidTotal = billNumber(bill, ["paid_total", "order_paid_total"], ["payment", "self", "order"]);
  const transfer = billNumber(bill, ["receive_transfer", "transfer_received", "transfer"], ["payment", "self"]);

  return (
    <section className="flex flex-col gap-2">
      <DetailSectionTitle>{t("salesList.payment")}</DetailSectionTitle>
      <div className="overflow-hidden rounded-lg border border-border">
        <ReceiptTotalRow label={t("salesList.cashReceived")} value={moneyOrDash(cash)} />
        <ReceiptTotalRow label={t("salesList.transferReceived")} value={moneyOrDash(transfer)} />
        <ReceiptTotalRow label={t("salesList.paidTotal")} value={moneyOrDash(paidTotal)} />
        <ReceiptTotalRow label={t("common.balance")} value={moneyOrDash(balance ?? debt)} />
        <ReceiptTotalRow label={t("salesList.change")} value={moneyOrDash(change)} />
      </div>
    </section>
  );
}

function ReceiptTotalRow({
  emphasis = false,
  label,
  tone,
  value
}: {
  emphasis?: boolean;
  label: ReactNode;
  tone?: "destructive";
  value: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0", emphasis && "bg-muted/45")}>
      <span className={cn("min-w-0 truncate text-muted-foreground", emphasis && "font-black text-foreground", tone === "destructive" && "text-destructive")}>{label}</span>
      <span className={cn("shrink-0 font-bold tabular-nums", emphasis && "font-black", tone === "destructive" && "text-destructive")}>{value}</span>
    </div>
  );
}

function DetailSectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-black">{children}</h3>;
}

function CancelBillDialog({
  bill,
  cancelling,
  open,
  reason,
  reasonInvalid,
  onOpenChange,
  onReasonBlur,
  onReasonChange,
  onSubmit
}: {
  bill: BillSource;
  cancelling: boolean;
  open: boolean;
  reason: string;
  reasonInvalid: boolean;
  onOpenChange: (open: boolean) => void;
  onReasonBlur: () => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 sm:max-w-lg">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader className="border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{t("salesList.cancelBill")}</DialogTitle>
            <DialogDescription>{t("salesList.cancelDescription", { invoice: billInvoice(bill) })}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            <FieldGroup>
              <Field data-invalid={reasonInvalid} className="gap-2">
                <FieldLabel htmlFor="sales-list-cancel-reason">{t("salesList.cancelReason")}</FieldLabel>
                <Textarea
                  id="sales-list-cancel-reason"
                  aria-invalid={reasonInvalid}
                  disabled={cancelling}
                  value={reason}
                  placeholder={t("salesList.cancelReasonPlaceholder")}
                  onBlur={onReasonBlur}
                  onChange={(event) => onReasonChange(event.target.value)}
                />
                <FieldDescription>{t("salesList.cancelReasonHelp")}</FieldDescription>
                {reasonInvalid ? <FieldError>{t("salesList.cancelReasonRequired")}</FieldError> : null}
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:px-6">
            <Button disabled={cancelling} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={cancelling || !reason.trim()} type="submit" variant="danger">
              {cancelling ? <Spinner data-icon="inline-start" /> : <Ban data-icon="inline-start" />}
              {t("salesList.confirmCancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelableBadge({ canCancel, compact = false }: { canCancel: boolean; compact?: boolean }) {
  const { t } = useTranslation();

  return canCancel ? (
    <Badge className={cn("border-primary/20 bg-primary/10 text-primary", compact && "px-1.5 text-[11px]")}>{t("salesList.canCancel")}</Badge>
  ) : (
    <Badge className={cn("border-border bg-muted text-muted-foreground", compact && "px-1.5 text-[11px]")}>{t("salesList.cannotCancel")}</Badge>
  );
}

function SalesListSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-2 p-2 sm:p-3 xl:gap-3">
      {Array.from({ length: 10 }).map((_, index) => (
        <Card key={index} className="overflow-hidden shadow-sm">
          <CardContent className="flex min-h-[156px] flex-col p-0 sm:min-h-[172px]">
            <div className="relative flex min-h-[94px] flex-1 flex-col items-center justify-center px-4 py-4 sm:min-h-[104px]">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-8 w-36 sm:h-9" />
              <Skeleton className="mt-3 h-3 w-44" />
              <Skeleton className="absolute right-3 top-3 size-3 rounded-full" />
            </div>
            <div className="grid grid-cols-2 border-t border-border bg-muted/45">
              {Array.from({ length: 4 }).map((_, cellIndex) => (
                <div
                  key={cellIndex}
                  className={cn(
                    "flex min-w-0 items-center gap-2 px-3 py-2",
                    cellIndex === 0 && "border-b border-r border-border",
                    cellIndex === 1 && "border-b border-border",
                    cellIndex === 2 && "border-r border-border"
                  )}
                >
                  <Skeleton className="size-4 shrink-0" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SalesDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-b border-r border-border p-3 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-5 w-24" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <div className="overflow-hidden rounded-lg border border-border">
            {Array.from({ length: sectionIndex === 0 ? 3 : 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="flex items-center justify-between gap-3 border-b border-border p-3 last:border-b-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
