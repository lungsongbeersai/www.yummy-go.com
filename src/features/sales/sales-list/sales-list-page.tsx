"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  BadgePercent,
  CalendarDays,
  CreditCard,
  Eye,
  EyeOff,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  ShoppingBag,
  StickyNote,
  Table2,
  Tag,
  Utensils,
  UserRound
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
  SALES_LIST_PAYMENT_METHOD_OPTIONS,
  billNeedsPaymentAttention,
  branchOptionFromRow,
  defaultSalesListFilters,
  firstNumber,
  formatSaleDate,
  itemMedia,
  itemNote,
  itemProductName,
  itemToppings,
  itemToppingTotal,
  moneyValue,
  readValue,
  saleListPrintBillSource,
  salesListRange,
  selectedBranchLabel,
  statusBadgeClass,
  textValue,
  type SalesListBranchOption,
  type SalesListFilters,
  type SalesListPaymentMethod
} from "./sales-list-utils";

const SALES_LIST_DESKTOP_MEDIA_QUERY = "(min-width: 1280px)";
const SALES_LIST_SUMMARY_CARDS_ID = "sales-list-summary-cards";

function shouldOpenMobileBillDetail() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia(SALES_LIST_DESKTOP_MEDIA_QUERY).matches;
}

export function SalesListPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const bills = useDailySaleItemsStore((state) => state.bills);
  const error = useDailySaleItemsStore((state) => state.error);
  const loading = useDailySaleItemsStore((state) => state.loading);
  const reportTotal = useDailySaleItemsStore((state) => state.reportTotal);
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
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
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
  const initialLoading = loading && !bills.length;

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
    setMobileDetailOpen(false);
  }, [defaultBranchUuid, resetPage, resetSalesItems]);

  useEffect(() => {
    const search = searchText.trim();
    const timer = window.setTimeout(() => {
      if (appliedFilters.search === search) return;
      setDraftFilters((current) => ({ ...current, search }));
      setAppliedFilters((current) => ({ ...current, search }));
      resetPage();
      setSelectedBillId("");
      setMobileDetailOpen(false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [appliedFilters.search, resetPage, searchText]);

  useEffect(() => {
    setSelectedBillId((current) => {
      if (current && bills.some((bill) => bill.id === current)) return current;
      return bills[0]?.id ?? "";
    });
  }, [bills]);

  useEffect(() => {
    if (mobileDetailOpen && !selectedBill) setMobileDetailOpen(false);
  }, [mobileDetailOpen, selectedBill]);

  useEffect(() => {
    if (!mobileDetailOpen) return;

    const mediaQuery = window.matchMedia(SALES_LIST_DESKTOP_MEDIA_QUERY);
    if (mediaQuery.matches) {
      setMobileDetailOpen(false);
      return;
    }

    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileDetailOpen(false);
    };

    mediaQuery.addEventListener("change", closeOnDesktop);
    return () => mediaQuery.removeEventListener("change", closeOnDesktop);
  }, [mobileDetailOpen]);

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
        payment_method: appliedFilters.paymentMethod,
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
    setMobileDetailOpen(false);
  }

  function applyMobileFilters() {
    applyFilters();
    setMobileFilterOpen(false);
  }

  async function reprintReceipt(group: DailySaleItemsBillGroup) {
    const orderUuid = textValue(readValue(group.raw, ["order_uuid"]), "");
    if (!orderUuid || !user?.uuid || printingBillId) return;

    const currentBranch = branches.find((branch) => branch.branch_uuid === branchUuid);
    const baseReceiptSource = saleListPrintBillSource(group);
    const receiptSource = {
      ...baseReceiptSource,
      branch_address:
        textValue(readValue(baseReceiptSource, ["branch_address"]), "") ||
        textValue(readValue(currentBranch ?? {}, ["branch_address"]), ""),
      branch_qr:
        textValue(readValue(baseReceiptSource, ["branch_qr", "qr_url", "payment_qr", "branch_qr_url"]), "") ||
        textValue(readValue(currentBranch ?? {}, ["branch_qr"]), ""),
      branch_tel:
        textValue(readValue(baseReceiptSource, ["branch_tel", "branch_phone", "tel", "phone"]), "") ||
        textValue(readValue(currentBranch ?? {}, ["branch_tel", "branch_phone", "tel", "phone"]), "")
    };
    const receiptData = buildSalesListInvoicePrintData({
      bill: receiptSource,
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

  function selectBill(billId: string) {
    setSelectedBillId(billId);
    if (shouldOpenMobileBillDetail()) setMobileDetailOpen(true);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/20 xl:overflow-hidden">
      <div className="mx-auto flex w-full max-w-375 flex-col gap-2 p-2 sm:gap-3 sm:p-3 lg:p-4 xl:h-full xl:min-h-0">
        <SalesListHeader
          appliedFilters={appliedFilters}
          branchLabel={branchLabel}
          branchLoading={branchLoading}
          branchOptions={branchOptions}
          canApply={canApply}
          draftFilters={draftFilters}
          loading={loading}
          searchText={searchText}
          summaryControlsId={SALES_LIST_SUMMARY_CARDS_ID}
          summaryVisible={summaryVisible}
          onApply={applyFilters}
          onDraftChange={patchDraft}
          onMobileFiltersOpen={() => setMobileFilterOpen(true)}
          onRefresh={() => void load()}
          onSearchChange={setSearchText}
          onSummaryToggle={() => setSummaryVisible((visible) => !visible)}
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

        <div id={SALES_LIST_SUMMARY_CARDS_ID} hidden={!summaryVisible}>
          <SalesListSummaryCards reportTotal={reportTotal} />
        </div>

        {initialLoading ? (
          <div className="min-w-0 xl:min-h-0 xl:flex-1">
            <LoadingState label={t("salesList.loading")} variant="splitPanel" />
          </div>
        ) : (
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
              onSelect={selectBill}
            />
            <SalesBillDetailPanel
              bill={selectedBill}
              className="hidden xl:flex"
              loading={loading}
              printingBillId={printingBillId}
              onReprint={(group) => void reprintReceipt(group)}
            />
          </div>
        )}
      </div>
      <SalesBillDetailDrawer
        bill={selectedBill}
        loading={loading}
        open={mobileDetailOpen}
        printingBillId={printingBillId}
        onOpenChange={setMobileDetailOpen}
        onReprint={(group) => void reprintReceipt(group)}
      />
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
  summaryControlsId,
  summaryVisible,
  onApply,
  onDraftChange,
  onMobileFiltersOpen,
  onRefresh,
  onSearchChange,
  onSummaryToggle
}: {
  appliedFilters: SalesListFilters;
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SalesListBranchOption[];
  canApply: boolean;
  draftFilters: SalesListFilters;
  loading: boolean;
  searchText: string;
  summaryControlsId: string;
  summaryVisible: boolean;
  onApply: () => void;
  onDraftChange: (patch: Partial<SalesListFilters>) => void;
  onMobileFiltersOpen: () => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onSummaryToggle: () => void;
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
          aria-controls={summaryControlsId}
          aria-expanded={summaryVisible}
          aria-label={summaryVisible ? t("report.hideSummary") : t("report.showSummary")}
          onClick={onSummaryToggle}
        >
          {summaryVisible ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
          <span className="sr-only">{summaryVisible ? t("report.hideSummary") : t("report.showSummary")}</span>
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
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-6">
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
        <FieldLabel htmlFor={`${idPrefix}-payment-method`} className="text-xs font-bold text-muted-foreground">
          {t("salesList.paymentMethod")}
        </FieldLabel>
        <Select
          value={draftFilters.paymentMethod}
          onValueChange={(value) => onDraftChange({ paymentMethod: value as SalesListPaymentMethod })}
        >
          <SelectTrigger id={`${idPrefix}-payment-method`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SALES_LIST_PAYMENT_METHOD_OPTIONS.map((paymentMethod) => (
                <SelectItem key={paymentMethod} value={paymentMethod}>
                  {paymentMethodLabel(paymentMethod, t)}
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
                  {t(order === "ASC" ? "common.oldestFirst" : "common.newestFirst")}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

type SalesListSummaryCardTone = "danger" | "neutral" | "primary";

interface SalesListSummaryCardConfig {
  key: string;
  kind: "count" | "money";
  label: string;
  tone: SalesListSummaryCardTone;
}

function SalesListSummaryCards({ reportTotal }: { reportTotal: ApiEntity }) {
  const { t } = useTranslation();
  const cards: SalesListSummaryCardConfig[] = [
    { key: "bill_count", kind: "count", label: t("salesList.summary.bills"), tone: "neutral" },
    { key: "total_qty", kind: "count", label: t("salesList.summary.qty"), tone: "neutral" },
    { key: "amount", kind: "money", label: t("salesList.summary.amount"), tone: "primary" },
    { key: "discount_item", kind: "money", label: t("salesList.summary.itemDiscount"), tone: "danger" },
    { key: "discount_bill", kind: "money", label: t("salesList.summary.billDiscount"), tone: "danger" },
    { key: "sum_discount", kind: "money", label: t("salesList.summary.discount"), tone: "danger" },
    { key: "sum_servicecharge", kind: "money", label: t("salesList.summary.serviceCharge"), tone: "neutral" },
    { key: "sum_vate", kind: "money", label: t("salesList.summary.vat"), tone: "neutral" },
    { key: "sum_total", kind: "money", label: t("salesList.summary.total"), tone: "primary" }
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <SalesListSummaryCard
          key={card.key}
          card={card}
          value={firstNumber(reportTotal, [card.key])}
        />
      ))}
    </section>
  );
}

function SalesListSummaryCard({
  card,
  value
}: {
  card: SalesListSummaryCardConfig;
  value: number;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-md border shadow-sm",
        card.tone === "primary" && "border-primary/20 bg-primary/5 shadow-primary/5",
        card.tone === "danger" && "border-destructive/20 bg-destructive/5 shadow-destructive/5",
        card.tone === "neutral" && "border-border bg-muted/20"
      )}
    >
      <CardContent className="p-2.5">
        <p
          className={cn(
            "truncate text-[11px] font-black leading-4",
            card.tone === "primary" && "text-primary",
            card.tone === "danger" && "text-destructive",
            card.tone === "neutral" && "text-muted-foreground"
          )}
        >
          {card.label}
        </p>
        <p className="mt-1 truncate text-base font-black tabular-nums text-foreground sm:text-lg">
          {card.kind === "money" ? money(value) : value.toLocaleString("en-US")}
        </p>
      </CardContent>
    </Card>
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
        {loading && !bills.length ? (
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
  const needsPaymentAttention = billNeedsPaymentAttention(bill);

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto w-full justify-start rounded-none border-b px-4 py-3 text-left shadow-none transition-colors",
        needsPaymentAttention
          ? "border-destructive/25 bg-destructive/15 hover:bg-destructive/20"
          : "border-border",
        selected &&
          (needsPaymentAttention
            ? "bg-destructive/20 hover:bg-destructive/20 ring-1 ring-inset ring-destructive/35"
            : "bg-primary/10 hover:bg-primary/10")
      )}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-md border border-border bg-muted",
            needsPaymentAttention && "border-destructive/30 bg-destructive/15 text-destructive",
            selected &&
              (needsPaymentAttention
                ? "border-destructive/40 bg-destructive/20 text-destructive"
                : "border-primary/25 bg-primary/15 text-primary")
          )}
        >
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
            <div className="flex min-w-0 items-center gap-1.5">
              {bill.status ? (
                <Badge className={cn("max-w-28 truncate", statusBadgeClass(bill.status))}>{bill.status}</Badge>
              ) : null}
              {needsPaymentAttention ? (
                <Badge className="max-w-36 truncate border-destructive/25 bg-destructive text-destructive-foreground">
                  {bill.debtAmount > 0 ? `${t("salesList.debt")}: ${money(bill.debtAmount)}` : t("salesList.debt")}
                </Badge>
              ) : null}
            </div>
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
  className,
  loading,
  onReprint,
  printingBillId,
  variant = "panel"
}: {
  bill: DailySaleItemsBillGroup | null;
  className?: string;
  loading: boolean;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  printingBillId: string;
  variant?: "panel" | "drawer";
}) {
  const { t } = useTranslation();
  const drawer = variant === "drawer";

  return (
    <Card className={cn("min-h-0 overflow-hidden border-border bg-card shadow-sm xl:flex xl:min-h-0 xl:flex-col", className)}>
      {!bill ? (
        <div className="flex min-h-96 flex-1 items-center justify-center p-4">
          <EmptyState title={t("salesList.noSelection")} description={t("salesList.selectBillHint")} />
        </div>
      ) : (
        <>
          <CardHeader className="flex-col items-stretch gap-2 border-b border-border px-3 py-2.5 md:flex-row md:items-start md:justify-between md:px-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base font-black">{t("salesList.billDetail")}</CardTitle>
              <BillHeaderFacts bill={bill} compact={drawer} />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full shrink-0 md:w-auto"
              disabled={!textValue(readValue(bill.raw, ["order_uuid"]), "") || Boolean(printingBillId) || loading}
              onClick={() => onReprint(bill)}
            >
              {printingBillId === bill.id ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
              {printingBillId === bill.id ? t("salesList.reprintingReceipt") : t("salesList.reprintReceipt")}
            </Button>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
              <SalesListItems items={bill.items} />
            </div>
            <SelectedBillSummary bill={bill} />
          </CardContent>
        </>
      )}
    </Card>
  );
}

function SalesBillDetailDrawer({
  bill,
  loading,
  onOpenChange,
  onReprint,
  open,
  printingBillId
}: {
  bill: DailySaleItemsBillGroup | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  open: boolean;
  printingBillId: string;
}) {
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[calc(100dvh-0.75rem)] max-h-[92dvh] gap-0 overflow-hidden rounded-t-xl xl:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t("salesList.billDetail")}</DrawerTitle>
          <DrawerDescription>{t("salesList.selectBillHint")}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SalesBillDetailPanel
            bill={bill}
            className="flex h-full flex-col rounded-none border-0 shadow-none"
            loading={loading}
            printingBillId={printingBillId}
            variant="drawer"
            onReprint={onReprint}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface BillReviewMetaItem {
  icon: ReactNode;
  label: string;
  value: string;
}

function billMetaText(bill: DailySaleItemsBillGroup, keys: string[]) {
  const summary = recordValue(bill.raw.summary);
  return textValue(readValue(bill.raw, keys) ?? readValue(summary ?? {}, keys), "");
}

function realMetaText(value: unknown) {
  const text = textValue(value, "").trim();
  return text && text !== "-" ? text : "";
}

function BillHeaderFacts({
  bill,
  compact = false
}: {
  bill: DailySaleItemsBillGroup;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const customerName = realMetaText(billMetaText(bill, ["customer_name", "customer"]));
  const customerPhone = realMetaText(billMetaText(bill, ["customer_phone", "phone", "tel"]));
  const memberCode = realMetaText(billMetaText(bill, ["member_code", "customer_code"]));
  const customerDetail = [customerName, memberCode, customerPhone].filter(Boolean).join(" / ");
  const orderChannel = realMetaText(billMetaText(bill, ["order_channel_name", "channel_name"]));
  const paymentFactCandidates: Array<BillReviewMetaItem | null> = [
    bill.receiveCashAmount > 0 ? { icon: <CreditCard />, label: t("salesList.cashReceived"), value: money(bill.receiveCashAmount) } : null,
    bill.receiveTransferAmount > 0 ? { icon: <CreditCard />, label: t("salesList.transferReceived"), value: money(bill.receiveTransferAmount) } : null,
    bill.changeAmount > 0 ? { icon: <ReceiptText />, label: t("salesList.change"), value: money(bill.changeAmount) } : null
  ];
  const paymentFacts = paymentFactCandidates.filter((item): item is BillReviewMetaItem => Boolean(item));
  const candidates: Array<BillReviewMetaItem | null> = [
    customerDetail ? { icon: <UserRound />, label: t("pos.customer"), value: customerDetail } : null,
    orderChannel ? { icon: <ReceiptText />, label: t("pos.orderChannel"), value: orderChannel } : null,
    ...paymentFacts
  ];
  const items = candidates
    .filter((item): item is BillReviewMetaItem => Boolean(item))
    .filter((item) => Boolean(realMetaText(item.value)));

  if (!items.length) return null;

  return (
    <div
      className={cn(
        "mt-2 grid min-w-0 grid-cols-1 gap-1.5 min-[430px]:grid-cols-2 md:flex md:flex-wrap",
        compact && "min-[360px]:grid-cols-2"
      )}
    >
      {items.map((item) => (
        <BillHeaderFact key={`${item.label}-${item.value}`} item={item} compact={compact} />
      ))}
    </div>
  );
}

function BillHeaderFact({
  compact,
  item
}: {
  compact: boolean;
  item: BillReviewMetaItem;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm",
        compact ? "" : "md:w-auto md:max-w-56 2xl:max-w-64"
      )}
      title={`${item.label}: ${item.value}`}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground/80 [&_svg]:size-3.5">{item.icon}</span>
      <span className="min-w-0 truncate">
        <span className="font-medium">{item.label}: </span>
        <span className="font-semibold text-foreground/85">{item.value}</span>
      </span>
    </span>
  );
}

function SalesListItems({ items }: { items: ApiEntity[] }) {
  const { t } = useTranslation();

  if (!items.length) {
    return <EmptyState title={t("salesList.noItems")} description={t("salesList.noItemsDescription")} />;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
      {items.map((item, index) => (
        <SalesListItemCard
          key={textValue(readValue(item, ["__report_record_id", "order_item_uuid"]), String(index))}
          item={item}
        />
      ))}
    </div>
  );
}

function paymentMethodLabel(
  paymentMethod: SalesListPaymentMethod,
  translate: (key: string) => string
) {
  const labels = {
    "1": translate("pos.paymentCash"),
    "2": translate("pos.paymentTransfer"),
    "4": translate("pos.paymentArrears"),
    All: translate("common.all")
  } satisfies Record<SalesListPaymentMethod, string>;

  return labels[paymentMethod];
}

function SalesListItemCard({ item }: { item: ApiEntity }) {
  const { t } = useTranslation();
  const media = itemMedia(item);
  const note = itemNote(item);
  const discount = firstNumber(item, ["discount_total", "discount_amount", "item_discount_amount", "discount_item_amount"]);
  const qty = firstNumber(item, ["qty", "quantity"]);
  const total = firstNumber(item, ["total", "line_total", "net_total"]);
  const amount = firstNumber(item, ["amount", "line_amount", "product_price_total"]);
  const unitPrice = qty > 0 && total > 0 ? total / qty : firstNumber(item, ["sale_price", "price", "unit_price", "product_price"]);

  return (
    <div className="border-b border-border/80 bg-background px-3 py-2.5 last:border-b-0 hover:bg-muted/20 sm:px-4">
      <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[52px_minmax(0,1fr)]">
        <SalesListItemMedia media={media} title={itemProductName(item)} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="min-w-0 wrap-break-word text-[15px] font-black leading-5 text-foreground">
              {itemProductName(item)}
            </p>
            <p className="max-w-32 shrink-0 truncate text-right text-[15px] font-black leading-5 text-foreground tabular-nums">
              {moneyValue(total)}
            </p>
          </div>

          <div className="mt-1.5 grid gap-0.5">
            <SalesListItemDetailRow icon={<Tag />} tone="price">
              <span className="tabular-nums">
                {qty.toLocaleString("en-US")} x {moneyValue(unitPrice)}
              </span>
            </SalesListItemDetailRow>
            {amount > 0 && amount !== total ? (
              <SalesListItemDetailRow tone="muted" right={moneyValue(amount)}>
                {t("salesList.amount")}
              </SalesListItemDetailRow>
            ) : null}
            <SalesListItemToppings item={item} />
            {discount > 0 ? (
              <SalesListItemDetailRow icon={<BadgePercent />} tone="discount" right={`-${moneyValue(discount)}`}>
                {t("salesList.discount")}
              </SalesListItemDetailRow>
            ) : null}
            {note ? (
              <SalesListItemDetailRow icon={<StickyNote />} tone="note">
                <span className="text-foreground/70">{t("salesList.note")}: </span>
                <span>{note}</span>
              </SalesListItemDetailRow>
            ) : null}
          </div>

          <div className="mt-2 flex min-w-0 justify-end">
            <Badge className="h-9 rounded-full border-border bg-muted px-3 text-sm font-black text-muted-foreground">
              x{qty.toLocaleString("en-US")}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesListItemMedia({
  media,
  title
}: {
  media: ReturnType<typeof itemMedia>;
  title: string;
}) {
  const colorStyle = media.type === "color" ? ({ backgroundColor: media.color } satisfies CSSProperties) : undefined;

  return (
    <div
      className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted shadow-sm"
      style={colorStyle}
    >
      {media.type === "image" ? (
        <Image src={media.src} alt={title} fill sizes="(max-width: 640px) 48px, 52px" className="object-cover" />
      ) : media.type === "color" ? (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" aria-hidden="true" />
          <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <span className="grid size-8 place-items-center rounded-full bg-black/25 text-white shadow-sm backdrop-blur-[1px]">
              <Utensils className="size-4" />
            </span>
          </span>
        </>
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ShoppingBag />
        </div>
      )}
    </div>
  );
}

type SalesListItemDetailTone = "discount" | "muted" | "note" | "price" | "topping";

function SalesListItemDetailRow({
  children,
  className,
  icon,
  right,
  tone = "muted"
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  right?: ReactNode;
  tone?: SalesListItemDetailTone;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-2 text-[11px] font-bold leading-4.5 sm:text-xs",
        tone === "price" && "text-foreground/75",
        tone === "discount" && "text-destructive",
        tone === "note" && "text-muted-foreground",
        tone === "topping" && "text-muted-foreground",
        tone === "muted" && "text-muted-foreground",
        className
      )}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        {icon ? <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">{icon}</span> : null}
        <span className="min-w-0 wrap-break-word">{children}</span>
      </span>
      {right ? (
        <span
          className={cn(
            "shrink-0 text-right font-black tabular-nums",
            tone === "discount" ? "text-destructive" : "text-foreground/75"
          )}
        >
          {right}
        </span>
      ) : null}
    </div>
  );
}

function SalesListItemToppings({ item }: { item: ApiEntity }) {
  const { t } = useTranslation();
  const toppings = itemToppings(item);
  const toppingTotal = itemToppingTotal(item);

  if (!toppings.length && toppingTotal <= 0) return null;

  return (
    <div className="grid gap-0.5">
      {toppings.length ? (
        toppings.map((topping, index) => (
          <SalesListItemDetailRow
            key={`${topping.name}-${index}`}
            className="pl-5"
            tone="topping"
            right={topping.total > 0 ? `+${moneyValue(topping.total)}` : null}
          >
            + {topping.name}{topping.qty > 0 ? ` x${topping.qty.toLocaleString("en-US")}` : ""}
          </SalesListItemDetailRow>
        ))
      ) : (
        <SalesListItemDetailRow className="pl-5" tone="topping" right={`+${moneyValue(toppingTotal)}`}>
          + {t("pos.toppingTotal")}
        </SalesListItemDetailRow>
      )}
    </div>
  );
}

type SummaryMetricTone =
  | "amount"
  | "discount"
  | "total"
  | "service"
  | "topping"
  | "vat";

interface SummaryMetric {
  label: string;
  tone: SummaryMetricTone;
  value: number;
}

function rateLabel(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  const percent = number > 0 && number <= 1 ? number * 100 : number;
  return `${percent.toLocaleString("lo-LA", { maximumFractionDigits: 2 })}%`;
}

function recordValue(value: unknown): ApiEntity | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiEntity : null;
}

function readRateLabel(source: ApiEntity, keys: string[], nestedKey: string) {
  const summary = recordValue(source.summary);
  const nested = recordValue(source[nestedKey]);
  return rateLabel(readValue(summary ?? {}, keys)) || rateLabel(readValue(nested ?? {}, keys)) || rateLabel(readValue(source, keys));
}

function calculatedRateLabel(amount: number, base: number) {
  if (amount <= 0 || base <= 0) return "";
  return rateLabel((amount / base) * 100);
}

function summaryMetricLabel(label: string, rate: string) {
  return rate ? `${label} (${rate})` : label;
}

function summaryMetricClass(tone: SummaryMetricTone) {
  const classes = {
    amount: "border-primary/20 bg-primary/10 text-primary",
    discount: "border-destructive/20 bg-destructive/10 text-destructive",
    total: "border-primary/20 bg-primary/10 text-primary",
    service: "border-border bg-muted/35 text-foreground",
    topping: "border-border bg-muted/35 text-foreground",
    vat: "border-border bg-muted/35 text-foreground"
  } satisfies Record<SummaryMetricTone, string>;

  return classes[tone];
}

function SelectedBillSummary({ bill }: { bill: DailySaleItemsBillGroup }) {
  const { t } = useTranslation();
  const serviceBase = bill.amountTotal + bill.toppingTotal - bill.discountTotal;
  const vatBase = serviceBase + bill.serviceChargeAmount;
  const serviceRate =
    readRateLabel(bill.raw, ["service_charge_rate", "service_rate", "order_service_rate", "charge_name", "rate"], "service_charge") ||
    calculatedRateLabel(bill.serviceChargeAmount, serviceBase);
  const vatRate =
    readRateLabel(bill.raw, ["vat_rate", "tax_rate", "order_vat_rate", "vat_name", "rate"], "vat") ||
    calculatedRateLabel(bill.vatAmount, vatBase);
  const allMetrics: SummaryMetric[] = [
    { label: t("salesList.amount"), tone: "amount", value: bill.amountTotal },
    { label: t("salesList.toppings"), tone: "topping", value: bill.toppingTotal },
    { label: t("salesList.discount"), tone: "discount", value: bill.discountTotal },
    { label: summaryMetricLabel(t("salesList.serviceCharge"), serviceRate), tone: "service", value: bill.serviceChargeAmount },
    { label: summaryMetricLabel(t("salesList.vat"), vatRate), tone: "vat", value: bill.vatAmount },
    { label: t("salesList.total"), tone: "total", value: bill.lineTotal }
  ];
  const metrics = allMetrics.filter((metric) => metric.tone === "amount" || metric.tone === "total" || metric.value > 0);

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 py-3 sm:px-4">
      <p className="text-sm font-black">{t("salesList.billSummary")}</p>
      <div className="mt-2 flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "flex min-w-0 items-center justify-between gap-3 px-3 py-2",
              summaryMetricClass(metric.tone)
            )}
          >
            <p className="truncate text-xs font-bold opacity-80">{metric.label}</p>
            <p className="shrink-0 text-sm font-black tabular-nums">{money(metric.value)}</p>
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

