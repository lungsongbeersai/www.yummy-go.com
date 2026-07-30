"use client";

import type { Route } from "next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { openLocalInvoicePrintWindow, type InvoicePrintData } from "@/services/printer/invoice-print-window";
import { buildSalesListInvoicePrintData } from "@/features/sales/cancel-sale/cancel-sale-utils";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useDailySaleItemsStore, type DailySaleItemsBillGroup } from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import {
  SALES_LIST_LIMIT_OPTIONS,
  branchOptionFromRow,
  cancelDateSelectForSaleDate,
  defaultSalesListFilters,
  readValue,
  saleListPrintBillSource,
  salesListRange,
  selectedBranchLabel,
  textValue,
  type SalesListFilters
} from "./sales-list-utils";

const SALES_LIST_DESKTOP_MEDIA_QUERY = "(min-width: 1280px)";

function shouldOpenMobileBillDetail() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia(SALES_LIST_DESKTOP_MEDIA_QUERY).matches;
}

export function useSalesListPage(initialPagination: UrlPaginationState) {
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
  const requestReprintReceipt = usePosStore((state) => state.reprintReceipt);
  const executeInvoice = usePrinterStore((state) => state.executeInvoice);
  const showToast = useToastStore((state) => state.show);
  const storeUuid = authStoreUuid(user);
  const userBranchUuid = user?.branch_uuid ?? "";
  const [draftFilters, setDraftFilters] = useState<SalesListFilters>(() =>
    defaultSalesListFilters(userBranchUuid, initialPagination.limit)
  );
  const [appliedFilters, setAppliedFilters] = useState<SalesListFilters>(() =>
    defaultSalesListFilters(userBranchUuid, initialPagination.limit)
  );
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const isDesktop = useMediaQuery(SALES_LIST_DESKTOP_MEDIA_QUERY);
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
    if (branchStoreSelectedUuid && (!branchOptionValues.size || branchOptionValues.has(branchStoreSelectedUuid))) {
      return branchStoreSelectedUuid;
    }
    if (userBranchUuid && (!branchOptionValues.size || branchOptionValues.has(userBranchUuid))) return userBranchUuid;
    return branchOptions[0]?.value ?? userBranchUuid;
  }, [branchOptionValues, branchOptions, branchStoreSelectedUuid, userBranchUuid]);
  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const branchLabel = selectedBranchLabel(branchOptions, branchUuid, user?.branch_name || branchUuid || "-");
  const canApply = Boolean(draftFilters.branchUuid && draftFilters.dateFrom && draftFilters.dateTo);
  const canReprintReceipt = Boolean(user?.uuid);
  const selectedBill = bills.find((bill) => bill.id === selectedBillId) ?? null;
  const selectedOrderUuid = selectedBill ? textValue(readValue(selectedBill.raw, ["order_uuid"]), "") : "";
  const cancelDateSelect = selectedBill ? cancelDateSelectForSaleDate(selectedBill.saleDate) : null;
  const cancelSaleHref =
    selectedBill &&
    !selectedBill.cancelled &&
    selectedOrderUuid &&
    cancelDateSelect &&
    branchUuid === userBranchUuid
      ? (`/sales/cancel-sale?order_uuid=${encodeURIComponent(selectedOrderUuid)}&date_select=${cancelDateSelect}` as Route)
      : null;
  const initialLoading = loading && !bills.length;

  useEffect(() => {
    if (!storeUuid) return;
    void loadBranches(storeUuid, userBranchUuid).catch(() => undefined);
  }, [loadBranches, storeUuid, userBranchUuid]);

  // สลับสาขา = ตั้ง filter ใหม่ กลับหน้าแรก และล้างบิลที่เลือกไว้
  useResetOnDeps([defaultBranchUuid, resetPage, resetSalesItems], () => {
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
  });

  // บิลชุดใหม่ = คงตัวที่เลือกไว้ถ้ายังอยู่ ไม่งั้นเลือกใบแรก
  useResetOnChange(bills, () => {
    setSelectedBillId((current) => {
      if (current && bills.some((bill) => bill.id === current)) return current;
      return bills[0]?.id ?? "";
    });
  });

  // บิลที่เปิดดูอยู่หายไป = ปิดแผงรายละเอียดบนมือถือ
  useResetOnDeps([mobileDetailOpen, selectedBill], () => {
    if (mobileDetailOpen && !selectedBill) setMobileDetailOpen(false);
  });

  // ปิดแผงมือถือเมื่อจอ "ข้าม" เป็น desktop — ไม่ derive จากค่า isDesktop ตรงๆ
  // เพราะย่อจอกลับมา mobile แล้วแผงต้องไม่เด้งเปิดเอง
  useResetOnDeps([isDesktop], () => {
    if (isDesktop) setMobileDetailOpen(false);
  });

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
    const nextFilters = { ...draftFilters, search: draftFilters.search.trim() };
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

  function buildFallbackReceiptData(group: DailySaleItemsBillGroup, receiptUser: AuthUser) {
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

    return buildSalesListInvoicePrintData({
      bill: receiptSource,
      translate: (key, options) => String(t(key, options)),
      user: receiptUser
    });
  }

  async function reprintReceipt(group: DailySaleItemsBillGroup) {
    const orderUuid = textValue(readValue(group.raw, ["order_uuid"]), "");
    if (!orderUuid || !user?.uuid || printingBillId) return;

    setPrintingBillId(group.id);
    try {
      const pendingQuery = await requestReprintReceipt({
        order_uuid: orderUuid,
        login_uuid_fk: user.uuid,
        lang: language
      });

      if (!pendingQuery) {
        showToast({
          title: t("salesList.reprintReceiptFailed"),
          description: t("salesList.reprintReceiptMissingJob"),
          tone: "error"
        });
        return;
      }

      let printStarted = false;
      const printResult = await executeInvoice({
        pending_query: pendingQuery,
        login_uuid_fk: user.uuid,
        onProgress: ({ phase }) => {
          if (phase === "printing") printStarted = true;
        }
      });

      if (printResult.successCount > 0 && printResult.failedCount === 0) {
        showToast({ title: t("salesList.reprintReceiptSuccess"), tone: "success" });
        return;
      }

      if (printResult.total === 0) {
        showToast({
          title: t("salesList.reprintReceiptFailed"),
          description: t("salesList.reprintReceiptMissingJob"),
          tone: "error"
        });
        return;
      }

      if (printResult.failedCount > 0 && printStarted && !isCapacitorNativeApp()) {
        await openReceiptPrintWindow(buildFallbackReceiptData(group, user), "");
        return;
      }

      showToast({ title: t("salesList.reprintReceiptFailed"), tone: "error" });
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

  return {
    appliedFilters,
    applyFilters,
    applyMobileFilters,
    bills,
    branchLabel,
    branchLoading,
    branchOptions,
    branchUuid,
    canApply,
    canReprintReceipt,
    cancelSaleHref,
    draftFilters,
    error,
    goToPage,
    initialLoading,
    load,
    loading,
    mobileDetailOpen,
    mobileFilterOpen,
    page,
    patchDraft,
    printingBillId,
    rangeLabel,
    reprintReceipt,
    reportTotal,
    safeTotalPages,
    selectBill,
    selectedBill,
    selectedBillId,
    setMobileDetailOpen,
    setMobileFilterOpen,
    setSummaryVisible,
    summaryVisible
  };
}
