"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CreditCard,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Table2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { openLocalInvoicePrintWindow, type InvoicePrintData } from "@/features/pos/print/invoice-print-window";
import { buildSalesListInvoicePrintData } from "@/features/sales/list/sales-list-utils";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { money } from "@/lib/format";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { cn } from "@/lib/utils";
import type { DailySaleItemsOrder } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useDailySaleItemsStore, type DailySaleItemsBillGroup } from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import {
  SALES_LIST_LIMIT_OPTIONS,
  SALES_LIST_ORDER_OPTIONS,
  branchOptionFromRow,
  defaultSalesListFilters,
  firstNumber,
  formatSaleDate,
  itemNote,
  itemProductName,
  moneyValue,
  readValue,
  saleListPrintBillSource,
  salesListRange,
  selectedBranchLabel,
  statusBadgeClass,
  textValue,
  type SalesListBranchOption,
  type SalesListFilters
} from "./sales-list-utils";

export function SalesListPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const bills = useDailySaleItemsStore((state) => state.bills);
  const error = useDailySaleItemsStore((state) => state.error);
  const loading = useDailySaleItemsStore((state) => state.loading);
  const responsePage = useDailySaleItemsStore((state) => state.page);
  const total = useDailySaleItemsStore((state) => state.total);
  const totalPages = useDailySaleItemsStore((state) => state.totalPages);
  const branches = useBranchStore((state) => state.branches);
  const branchLoading = useBranchStore((state) => state.loading);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const loadBranches = useBranchStore((state) => state.loadBranches);
  const selectedBranchUuid = useBranchStore((state) => state.selectedBranchUuid);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const loadSalesItems = useDailySaleItemsStore((state) => state.load);
  const resetSalesItems = useDailySaleItemsStore((state) => state.reset);
  const showToast = useToastStore((state) => state.show);
  const storeUuid = authStoreUuid(user);
  const userBranchUuid = user?.branch_uuid ?? "";
  const [draftFilters, setDraftFilters] = useState<SalesListFilters>(() => defaultSalesListFilters(userBranchUuid, initialPagination.limit));
  const [appliedFilters, setAppliedFilters] = useState<SalesListFilters>(() => defaultSalesListFilters(userBranchUuid, initialPagination.limit));
  const [searchText, setSearchText] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [printingBillId, setPrintingBillId] = useState("");
  const { changeLimit, goToPage, page, resetPage } = useUrlPagination({
    initialPagination,
    limitOptions: SALES_LIST_LIMIT_OPTIONS
  });
  const safeTotalPages = Math.max(1, totalPages);
  const range = salesListRange(responsePage || page, appliedFilters.limit, bills.length, total);
  const rangeLabel = t("salesList.range", { end: range.end, start: range.start, total });
  const branchOptions = useMemo(() => {
    const storeBranches = branchStoreUuid === storeUuid ? branches : [];
    const options = storeBranches
      .map((branch) => branchOptionFromRow(branch, language))
      .filter((option): option is NonNullable<typeof option> => Boolean(option));

    if (userBranchUuid && !options.some((option) => option.value === userBranchUuid)) {
      options.unshift({ value: userBranchUuid, label: user?.branch_name || userBranchUuid });
    }

    return options;
  }, [branches, branchStoreUuid, language, storeUuid, user?.branch_name, userBranchUuid]);
  const branchOptionValues = useMemo(() => new Set(branchOptions.map((option) => option.value)), [branchOptions]);
  const branchStoreSelectedUuid = branchStoreUuid === storeUuid ? selectedBranchUuid : "";
  const defaultBranchUuid = useMemo(() => {
    if (branchStoreSelectedUuid && (!branchOptionValues.size || branchOptionValues.has(branchStoreSelectedUuid))) return branchStoreSelectedUuid;
    if (userBranchUuid && (!branchOptionValues.size || branchOptionValues.has(userBranchUuid))) return userBranchUuid;
    return branchOptions[0]?.value ?? userBranchUuid;
  }, [branchOptionValues, branchOptions, branchStoreSelectedUuid, userBranchUuid]);
  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const branchLabel = selectedBranchLabel(branchOptions, branchUuid, user?.branch_name || branchUuid || "-");
  const canApply = Boolean(draftFilters.branchUuid && draftFilters.dateFrom && draftFilters.dateTo);
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < safeTotalPages && !loading;
  const selectedBill = bills.find((bill) => bill.id === selectedBillId) ?? null;

  useEffect(() => {
    if (!storeUuid) return;
    void loadBranches(storeUuid, userBranchUuid).catch(() => undefined);
  }, [loadBranches, storeUuid, userBranchUuid]);

  useEffect(() => {
    if (!defaultBranchUuid) {
      resetSalesItems();
      return;
    }

    setDraftFilters((current) =>
      current.branchUuid === defaultBranchUuid ? current : { ...current, branchUuid: defaultBranchUuid }
    );
    setAppliedFilters((current) =>
      current.branchUuid === defaultBranchUuid ? current : { ...current, branchUuid: defaultBranchUuid }
    );
    resetPage();
    setSelectedBillId("");
  }, [defaultBranchUuid, resetPage, resetSalesItems]);

  useEffect(() => {
    const search = searchText.trim();
    const timer = window.setTimeout(() => {
      if (appliedFilters.search === search) return;
      setDraftFilters((current) => ({ ...current, search }));
      setAppliedFilters((current) => ({ ...current, search }));
      resetPage();
      setSelectedBillId("");
    }, 350);

    return () => window.clearTimeout(timer);
  }, [appliedFilters.search, resetPage, searchText]);

  useEffect(() => {
    setSelectedBillId((current) => {
      if (current && bills.some((bill) => bill.id === current)) return current;
      return bills[0]?.id ?? "";
    });
  }, [bills]);

  const load = useCallback(async () => {
    const selectedBranch = appliedFilters.branchUuid || defaultBranchUuid;
    if (!selectedBranch || !appliedFilters.dateFrom || !appliedFilters.dateTo) {
      resetSalesItems();
      return;
    }

    try {
      await loadSalesItems({
        branch_uuid_fk: selectedBranch,
        date_from: appliedFilters.dateFrom,
        date_to: appliedFilters.dateTo,
        lang: language,
        limit: appliedFilters.limit,
        orderBy: appliedFilters.orderBy,
        page,
        search: appliedFilters.search
      });
    } catch (loadError) {
      showToast({
        title: t("salesList.loadFailed"),
        description: loadError instanceof Error ? loadError.message : "",
        tone: "error"
      });
    }
  }, [appliedFilters, defaultBranchUuid, language, loadSalesItems, page, resetSalesItems, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && page > safeTotalPages) goToPage(safeTotalPages);
  }, [goToPage, loading, page, safeTotalPages]);

  function patchDraft(patch: Partial<SalesListFilters>) {
    setDraftFilters((current) => ({ ...current, ...patch }));
  }

  function applyFilters() {
    if (!canApply) return;
    const nextFilters = { ...draftFilters, search: searchText.trim() };
    setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    changeLimit(nextFilters.limit);
    resetPage();
    setSelectedBillId("");
  }

  function applyMobileFilters() {
    applyFilters();
    setMobileFilterOpen(false);
  }

  async function reprintReceipt(group: DailySaleItemsBillGroup) {
    const orderUuid = textValue(readValue(group.raw, ["order_uuid"]), "");
    if (!orderUuid || !user?.uuid || printingBillId) return;

    const receiptData = buildSalesListInvoicePrintData({
      bill: saleListPrintBillSource(group),
      translate: (key, options) => String(t(key, options)),
      user
    });

    setPrintingBillId(group.id);
    try {
      await openReceiptPrintWindow(receiptData, "");
    } catch (printError) {
      showToast({
        title: t("salesList.reprintReceiptFailed"),
        description: printError instanceof Error ? printError.message : "",
        tone: "error"
      });
    } finally {
      setPrintingBillId("");
    }
  }

  async function openReceiptPrintWindow(data: InvoicePrintData, description: string) {
    const opened = await openLocalInvoicePrintWindow(data);
    if (opened) {
      showToast({
        title: t("salesList.reprintReceiptFallback"),
        description,
        tone: "info"
      });
      return;
    }

    showToast({
      title: t("salesList.reprintReceiptFailed"),
      description: t("salesList.reprintReceiptPopupBlocked"),
      tone: "error"
    });
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/20 xl:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2 p-2 sm:gap-3 sm:p-3 lg:p-4 xl:h-full xl:min-h-0">
        <SalesListHeader
          appliedFilters={appliedFilters}
          branchLabel={branchLabel}
          branchLoading={branchLoading}
          branchOptions={branchOptions}
          canApply={canApply}
          draftFilters={draftFilters}
          loading={loading}
          searchText={searchText}
          onApply={applyFilters}
          onDraftChange={patchDraft}
          onMobileFiltersOpen={() => setMobileFilterOpen(true)}
          onRefresh={() => void load()}
          onSearchChange={setSearchText}
        />

        <SalesListFilterSheet
          branchLabel={branchLabel}
          branchLoading={branchLoading}
          branchOptions={branchOptions}
          canApply={canApply}
          draftFilters={draftFilters}
          loading={loading}
          open={mobileFilterOpen}
          onApply={applyMobileFilters}
          onDraftChange={patchDraft}
          onOpenChange={setMobileFilterOpen}
          onRefresh={() => void load()}
        />

        {!branchUuid ? (
          <SalesListError
            title={t("salesList.branchRequired")}
            description={t("salesList.branchRequiredDescription")}
          />
        ) : null}
        {error ? <SalesListError title={t("salesList.loadFailed")} description={error} /> : null}

        <div className="grid min-w-0 gap-2 sm:gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
          <SalesBillListPanel
            bills={bills}
            canGoBack={canGoBack}
            canGoNext={canGoNext}
            loading={loading}
            page={page}
            rangeLabel={rangeLabel}
            selectedBillId={selectedBillId}
            totalPages={safeTotalPages}
            onBack={() => goToPage(page - 1)}
            onNext={() => goToPage(page + 1)}
            onPageChange={goToPage}
            onSelect={setSelectedBillId}
          />
          <SalesBillDetailPanel
            bill={selectedBill}
            loading={loading}
            printingBillId={printingBillId}
            onReprint={(group) => void reprintReceipt(group)}
          />
        </div>
      </div>
    </div>
  );
}

function SalesListHeader({
  appliedFilters,
  branchLabel,
  branchLoading,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  searchText,
  onApply,
  onDraftChange,
  onMobileFiltersOpen,
  onRefresh,
  onSearchChange
}: {
  appliedFilters: SalesListFilters;
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SalesListBranchOption[];
  canApply: boolean;
  draftFilters: SalesListFilters;
  loading: boolean;
  searchText: string;
  onApply: () => void;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
  onMobileFiltersOpen: () => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);

  function applyDesktopFilters() {
    if (!canApply) return;
    onApply();
    setDesktopFiltersOpen(false);
  }

  return (
    <div className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("actions.search")}
            className="h-9 pl-9"
            placeholder={t("actions.search")}
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Badge className="hidden h-9 max-w-72 shrink-0 gap-1.5 rounded-md px-3 md:inline-flex">
          <CalendarDays data-icon="inline-start" />
          <span className="truncate">
            {appliedFilters.dateFrom} - {appliedFilters.dateTo}
          </span>
        </Badge>
        <SalesListFilterPopover
          branchLabel={branchLabel}
          branchLoading={branchLoading}
          branchOptions={branchOptions}
          canApply={canApply}
          draftFilters={draftFilters}
          loading={loading}
          open={desktopFiltersOpen}
          onApply={applyDesktopFilters}
          onDraftChange={onDraftChange}
          onOpenChange={setDesktopFiltersOpen}
          onRefresh={onRefresh}
        />
        <Button
          type="button"
          variant="outline"
          size="iconSm"
          className="h-9 w-9 shrink-0 sm:hidden"
          aria-label={t("salesList.filters")}
          onClick={onMobileFiltersOpen}
        >
          <SlidersHorizontal data-icon="inline-start" />
          <span className="sr-only">{t("salesList.filters")}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="iconSm"
          className="h-9 w-9 shrink-0"
          aria-label={t("actions.refresh")}
          disabled={loading || !canApply}
          onClick={onRefresh}
        >
          <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
          <span className="sr-only">{t("actions.refresh")}</span>
        </Button>
      </div>
    </div>
  );
}

function SalesListFilterPopover({
  branchLabel,
  branchLoading,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  open,
  onApply,
  onDraftChange,
  onOpenChange,
  onRefresh
}: {
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SalesListBranchOption[];
  canApply: boolean;
  draftFilters: SalesListFilters;
  loading: boolean;
  open: boolean;
  onApply: () => void;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="hidden h-9 shrink-0 sm:inline-flex">
          <SlidersHorizontal data-icon="inline-start" />
          {t("salesList.filters")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="hidden w-[calc(100vw-2rem)] max-w-4xl p-0 sm:block">
        <PopoverHeader className="border-b border-border px-4 py-3">
          <PopoverTitle className="text-sm font-black">{t("salesList.filters")}</PopoverTitle>
          <PopoverDescription className="text-xs">{t("salesList.subtitle")}</PopoverDescription>
        </PopoverHeader>
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
          <SalesListFilterFields
            branchLabel={branchLabel}
            branchLoading={branchLoading}
            branchOptions={branchOptions}
            draftFilters={draftFilters}
            idPrefix="sales-list"
            onDraftChange={onDraftChange}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={loading || !canApply} onClick={onRefresh}>
            <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
            {t("actions.refresh")}
          </Button>
          <Button type="button" size="sm" className="h-9" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
            {t("salesList.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SalesListFilterSheet({
  branchLabel,
  branchLoading,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  open,
  onApply,
  onDraftChange,
  onOpenChange,
  onRefresh
}: {
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SalesListBranchOption[];
  canApply: boolean;
  draftFilters: SalesListFilters;
  loading: boolean;
  open: boolean;
  onApply: () => void;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-xl p-0 sm:hidden">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base font-black">{t("salesList.filters")}</SheetTitle>
          <SheetDescription>{t("salesList.subtitle")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-3">
            <SalesListFilterFields
              branchLabel={branchLabel}
              branchLoading={branchLoading}
              branchOptions={branchOptions}
              draftFilters={draftFilters}
              idPrefix="sales-list-mobile"
              onDraftChange={onDraftChange}
            />
          </div>
        </div>
        <SheetFooter className="grid grid-cols-3 gap-2 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              {t("actions.close")}
            </Button>
          </SheetClose>
          <Button type="button" variant="outline" disabled={loading || !canApply} onClick={onRefresh}>
            <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
            {t("actions.refresh")}
          </Button>
          <Button type="button" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
            {t("salesList.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SalesListFilterFields({
  branchLabel,
  branchLoading,
  branchOptions,
  draftFilters,
  idPrefix,
  onDraftChange
}: {
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SalesListBranchOption[];
  draftFilters: SalesListFilters;
  idPrefix: string;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-branch`} className="text-xs font-bold text-muted-foreground">
          {t("nav.branch")}
        </FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLoading || branchOptions.length <= 1}
          onValueChange={(value) => onDraftChange({ branchUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="w-full">
            <SelectValue placeholder={branchLabel || t("nav.branch")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {branchOptions.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-date-from`} className="text-xs font-bold text-muted-foreground">
          {t("salesList.dateFrom")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-from`}
          type="date"
          value={draftFilters.dateFrom}
          onChange={(event) => onDraftChange({ dateFrom: event.target.value })}
        />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-date-to`} className="text-xs font-bold text-muted-foreground">
          {t("salesList.dateTo")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-to`}
          type="date"
          value={draftFilters.dateTo}
          onChange={(event) => onDraftChange({ dateTo: event.target.value })}
        />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-limit`} className="text-xs font-bold text-muted-foreground">
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) => onDraftChange({ limit: Number(value) as PageLimit })}
        >
          <SelectTrigger id={`${idPrefix}-limit`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SALES_LIST_LIMIT_OPTIONS.map((limit) => (
                <SelectItem key={String(limit)} value={String(limit)}>
                  {limit}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-order`} className="text-xs font-bold text-muted-foreground">
          {t("salesList.orderBy")}
        </FieldLabel>
        <Select
          value={draftFilters.orderBy}
          onValueChange={(value) => onDraftChange({ orderBy: value as DailySaleItemsOrder })}
        >
          <SelectTrigger id={`${idPrefix}-order`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SALES_LIST_ORDER_OPTIONS.map((order) => (
                <SelectItem key={order} value={order}>
                  {order}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

function SalesBillListPanel({
  bills,
  canGoBack,
  canGoNext,
  loading,
  onBack,
  onNext,
  onPageChange,
  onSelect,
  page,
  rangeLabel,
  selectedBillId,
  totalPages
}: {
  bills: DailySaleItemsBillGroup[];
  canGoBack: boolean;
  canGoNext: boolean;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
  onSelect: (billId: string) => void;
  page: number;
  rangeLabel: string;
  selectedBillId: string;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 overflow-hidden border-border bg-card shadow-sm xl:flex xl:min-h-0 xl:flex-col">
      <CardHeader className="shrink-0 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base font-black">
            <ReceiptText />
            <span className="truncate">{t("salesList.billList")}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4">
            <LoadingState label={t("salesList.loading")} variant="table" />
          </div>
        ) : bills.length ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {bills.map((bill) => (
                <BillListItem
                  key={bill.id}
                  bill={bill}
                  selected={bill.id === selectedBillId}
                  onSelect={() => onSelect(bill.id)}
                />
              ))}
            </div>
            <SalesListPagination
              canGoBack={canGoBack}
              canGoNext={canGoNext}
              page={page}
              rangeLabel={rangeLabel}
              totalPages={totalPages}
              onBack={onBack}
              onNext={onNext}
              onPageChange={onPageChange}
            />
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center p-4">
            <EmptyState title={t("salesList.noBills")} description={t("salesList.adjustFilters")} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BillListItem({
  bill,
  onSelect,
  selected
}: {
  bill: DailySaleItemsBillGroup;
  onSelect: () => void;
  selected: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto w-full justify-start rounded-none border-b border-border px-4 py-3 text-left shadow-none",
        selected && "bg-primary/10 hover:bg-primary/10"
      )}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
        <div className={cn("flex size-11 items-center justify-center rounded-md border border-border bg-muted", selected && "border-primary/25 bg-primary/15 text-primary")}>
          <ReceiptText className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-sm font-black text-foreground">{bill.invoiceNumber}</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{formatSaleDate(bill.saleDate)}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Table2 className="size-3.5 shrink-0" />
            <span className="truncate">{bill.tableName}</span>
            <CreditCard className="size-3.5 shrink-0" />
            <span className="truncate">{bill.paymentMethodName}</span>
          </div>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <Badge className={statusBadgeClass(bill.status)}>{bill.status}</Badge>
            <span className="shrink-0 text-sm font-black tabular-nums text-foreground">{money(bill.lineTotal)}</span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {t("salesList.items")}: {bill.itemCount.toLocaleString("en-US")} · {t("salesList.qty")}: {bill.qtyTotal.toLocaleString("en-US")}
          </p>
        </div>
      </div>
    </Button>
  );
}

function SalesBillDetailPanel({
  bill,
  loading,
  onReprint,
  printingBillId
}: {
  bill: DailySaleItemsBillGroup | null;
  loading: boolean;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  printingBillId: string;
}) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 overflow-hidden border-border bg-card shadow-sm xl:flex xl:min-h-0 xl:flex-col">
      {!bill ? (
        <div className="flex min-h-96 flex-1 items-center justify-center p-4">
          <EmptyState title={t("salesList.noSelection")} description={t("salesList.selectBillHint")} />
        </div>
      ) : (
        <>
          <CardHeader className="shrink-0 flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
            <div className="min-w-0">
              <CardTitle className="truncate text-lg font-black">{bill.invoiceNumber}</CardTitle>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge className={statusBadgeClass(bill.status)}>{bill.status}</Badge>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <CalendarDays className="size-4" />
                  <span className="truncate">{formatSaleDate(bill.saleDate)}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Table2 className="size-4" />
                  <span className="truncate">{bill.tableName}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <CreditCard className="size-4" />
                  <span className="truncate">{bill.paymentMethodName}</span>
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full shrink-0 sm:w-auto"
              disabled={!textValue(readValue(bill.raw, ["order_uuid"]), "") || Boolean(printingBillId) || loading}
              onClick={() => onReprint(bill)}
            >
              {printingBillId === bill.id ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
              {printingBillId === bill.id ? t("salesList.reprintingReceipt") : t("salesList.reprintReceipt")}
            </Button>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <div className="min-h-0 flex-1 p-3 sm:p-4 xl:overflow-auto">
              <SalesListItems items={bill.items} />
            </div>
            <SelectedBillSummary bill={bill} />
          </CardContent>
        </>
      )}
    </Card>
  );
}

function SalesListItems({ items }: { items: ApiEntity[] }) {
  const { t } = useTranslation();

  if (!items.length) {
    return <EmptyState title={t("salesList.noItems")} description={t("salesList.noItemsDescription")} />;
  }

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card md:hidden">
        {items.map((item, index) => (
          <SalesListItemCard
            key={textValue(readValue(item, ["__report_record_id", "order_item_uuid"]), String(index))}
            item={item}
            index={index}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-md border border-border bg-card md:block">
        <Table className="min-w-[940px] text-[13px]">
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className="w-[64px] whitespace-nowrap text-center">{t("fields.no")}</TableHead>
            <TableHead className="min-w-[220px] whitespace-nowrap">{t("salesList.product")}</TableHead>
            <TableHead className="min-w-[82px] whitespace-nowrap text-right">{t("salesList.qty")}</TableHead>
            <TableHead className="min-w-[116px] whitespace-nowrap text-right">{t("salesList.price")}</TableHead>
            <TableHead className="min-w-[116px] whitespace-nowrap text-right">{t("salesList.amount")}</TableHead>
            <TableHead className="min-w-[116px] whitespace-nowrap text-right">{t("salesList.discount")}</TableHead>
            <TableHead className="min-w-[116px] whitespace-nowrap text-right">{t("salesList.toppings")}</TableHead>
            <TableHead className="min-w-[128px] whitespace-nowrap text-right">{t("salesList.total")}</TableHead>
            <TableHead className="min-w-[220px] whitespace-nowrap">{t("salesList.note")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={textValue(readValue(item, ["__report_record_id", "order_item_uuid"]), String(index))} className="bg-card">
              <TableCell className="whitespace-nowrap text-center font-black text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-bold">{itemProductName(item)}</span>
                  <span className="text-xs text-muted-foreground">{textValue(readValue(item, ["prod_code", "product_code"]), "")}</span>
                </div>
              </TableCell>
              <NumberCell value={firstNumber(item, ["qty", "quantity"])} />
              <MoneyCell value={firstNumber(item, ["sale_price", "price", "unit_price"])} />
              <MoneyCell value={firstNumber(item, ["amount", "line_amount"])} />
              <MoneyCell value={firstNumber(item, ["discount_total", "discount_amount", "item_discount_amount"])} />
              <MoneyCell value={firstNumber(item, ["topping_total", "topping_unit_total"])} />
              <MoneyCell value={firstNumber(item, ["total", "line_total", "net_total"])} strong />
              <TableCell className="max-w-[260px] whitespace-normal text-muted-foreground">{itemNote(item) || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
    </>
  );
}

function SalesListItemCard({ index, item }: { index: number; item: ApiEntity }) {
  const { t } = useTranslation();
  const code = textValue(readValue(item, ["prod_code", "product_code"]), "");
  const note = itemNote(item);
  const discount = firstNumber(item, ["discount_total", "discount_amount", "item_discount_amount"]);
  const toppings = firstNumber(item, ["topping_total", "topping_unit_total"]);

  return (
    <div className={cn("flex flex-col gap-2 px-3 py-3", index > 0 && "border-t border-border")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black">{itemProductName(item)}</p>
          {code ? <p className="mt-1 truncate text-xs text-muted-foreground">{code}</p> : null}
        </div>
        <p className="shrink-0 text-right text-sm font-black tabular-nums">
          {moneyValue(firstNumber(item, ["total", "line_total", "net_total"]))}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/35 px-3 py-2 text-xs">
        <CompactMetric label={t("fields.no")} value={String(index + 1)} />
        <CompactMetric label={t("salesList.qty")} value={firstNumber(item, ["qty", "quantity"]).toLocaleString("en-US")} />
        <CompactMetric label={t("salesList.price")} value={moneyValue(firstNumber(item, ["sale_price", "price", "unit_price"]))} />
        <CompactMetric label={t("salesList.amount")} value={moneyValue(firstNumber(item, ["amount", "line_amount"]))} />
        {toppings > 0 ? <CompactMetric label={t("salesList.toppings")} value={moneyValue(toppings)} /> : null}
        {discount > 0 ? <CompactMetric label={t("salesList.discount")} value={`-${moneyValue(discount)}`} tone="destructive" /> : null}
      </div>
      {note ? (
        <div className="flex min-w-0 justify-between gap-3 text-xs">
          <span className="shrink-0 font-semibold text-muted-foreground">{t("salesList.note")}</span>
          <span className="min-w-0 break-words text-right text-muted-foreground">{note}</span>
        </div>
      ) : null}
    </div>
  );
}

function CompactMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone?: "destructive";
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 truncate font-black tabular-nums", tone === "destructive" && "text-destructive")}>{value}</p>
    </div>
  );
}

function SelectedBillSummary({ bill }: { bill: DailySaleItemsBillGroup }) {
  const { t } = useTranslation();
  const metrics = [
    { label: t("salesList.amount"), value: bill.amountTotal },
    { label: t("salesList.toppings"), value: bill.toppingTotal },
    { label: t("salesList.discount"), value: bill.discountTotal },
    { label: t("salesList.serviceCharge"), value: bill.serviceChargeAmount },
    { label: t("salesList.vat"), value: bill.vatAmount },
    { label: t("salesList.cashReceived"), value: bill.receiveCashAmount },
    { label: t("salesList.transferReceived"), value: bill.receiveTransferAmount },
    { label: t("salesList.debt"), value: bill.debtAmount }
  ];

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black">{t("salesList.billSummary")}</p>
        <p className="text-lg font-black tabular-nums text-primary">{money(bill.lineTotal)}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-md border border-border bg-muted/35 px-3 py-2">
            <p className="truncate text-xs font-bold text-muted-foreground">{metric.label}</p>
            <p className="mt-1 truncate text-sm font-black tabular-nums">{money(metric.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesListPagination({
  onPageChange,
  page,
  totalPages
}: {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}) {
  return (
    <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <AppPagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function SalesListError({ description, title }: { description: string; title: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

function NumberCell({ value }: { value: number }) {
  return (
    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
      {value.toLocaleString("en-US")}
    </TableCell>
  );
}

function MoneyCell({ strong, value }: { strong?: boolean; value: number }) {
  return (
    <TableCell className={cn("whitespace-nowrap text-right tabular-nums", strong && "font-black")}>
      {moneyValue(value)}
    </TableCell>
  );
}
