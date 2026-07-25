"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { localDateInputValue } from "@/lib/format";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useDailyStoreClosingReportStore } from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import { openReceiptPrintWindow, renderReceiptPrintWindow } from "../shared/report-receipt-print";
import { useReportBranchSelection } from "../shared/use-report-branch-selection";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";
import {
  type DailyClosingPrintData,
  renderDailyClosingPrintHtml,
} from "./daily-closing-report-print";
import {
  dailyClosingPaymentDifference,
  dailyClosingReportItemCount,
} from "./daily-closing-report-utils";

export function useDailyClosingReportWorkflow() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const branches = useBranchStore((state) => state.branches);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const error = useDailyStoreClosingReportStore((state) => state.error);
  const loading = useDailyStoreClosingReportStore((state) => state.loading);
  const report = useDailyStoreClosingReportStore((state) => state.report);
  const loadReport = useDailyStoreClosingReportStore((state) => state.load);
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<DailyClosingReportFilters>({
    branchUuid: user?.branch_uuid ?? "",
    date: today,
  });
  const [appliedFilters, setAppliedFilters] = useState<DailyClosingReportFilters>(draftFilters);
  const [printing, setPrinting] = useState(false);

  const {
    branchError: branchSelectionError,
    branchLabelFor,
    branchLoading: branchSelectionLoading,
    branchOptions,
    canSelectBranch,
    defaultBranchUuid,
    normalizeBranchFilters,
    storeUuid,
    userBranchUuid,
  } = useReportBranchSelection();

  const storeBranches = useMemo(
    () => (branchStoreUuid === storeUuid ? branches : []),
    [branches, branchStoreUuid, storeUuid],
  );
  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const activeBranch = storeBranches.find((branch) => branch.branch_uuid === branchUuid);
  const activeBranchLabel = branchLabelFor(branchUuid);
  const activeBranchAddress =
    activeBranch?.branch_address ||
    (branchUuid === userBranchUuid ? user?.branch_address : "") ||
    "";
  const activeBranchTel =
    activeBranch?.branch_tel ||
    (branchUuid === userBranchUuid ? user?.branch_tel : "") ||
    "";
  const reportTitle = t("report.dailyClosing.title");
  const paymentDifference = report ? dailyClosingPaymentDifference(report) : 0;
  const itemCount = report ? dailyClosingReportItemCount(report) : 0;
  const balanced = Math.abs(paymentDifference) < 0.01;
  const canApply = Boolean((draftFilters.branchUuid || defaultBranchUuid) && draftFilters.date);
  const printDisabled = loading || printing || !branchUuid || !report;
  const cashier = user?.email?.split("@")[0] || user?.email || "-";
  const storeName = user?.store_name || "Yummy Go";

  const printLabels = useMemo<DailyClosingPrintData["labels"]>(
    () => ({
      businessDate: t("report.dailyClosing.businessDate"),
      cancelledBills: t("report.dailyClosing.cancelBill"),
      cash: t("report.dailyClosing.cash"),
      cashier: t("cancelSale.cashier"),
      credit: t("report.dailyClosing.credit"),
      discount: t("report.dailyClosing.discountAmount"),
      employeeSignature: t("report.dailyClosing.employeeSignature"),
      grandTotal: t("report.dailyClosing.grandTotal"),
      group: t("report.dailyPrint.group"),
      groupTotal: t("report.dailyClosing.groupTotal"),
      // ดึงคำว่า "ລາຍການ" จาก locale
      items: t("salesList.summary.items"),
      noData: t("report.dailyClosing.noData"),
      paymentTotal: t("report.dailyClosing.paymentTotal"),
      product: t("report.dailyClosing.product"),
      quantity: t("report.columns.quantity"),
      revenueSummary: t("report.dailyClosing.salesSummary"),
      serviceCharge: t("report.dailyClosing.serviceCharge"),
      storeManagerSignature: t("report.dailyClosing.storeManagerSignature"),
      title: t("report.dailyClosing.title"),
      totalAmount: t("report.dailyClosing.totalAmount"),
      totalQuantity: t("report.dailyClosing.totalQty"),
      transfer: t("report.dailyClosing.transfer"),
      vat: t("report.dailyClosing.vat"),
    }),
    [t],
  );

  const buildPrintData = useCallback(
    (reportArg: NonNullable<typeof report>, businessDate: string): DailyClosingPrintData => ({
      branchName: activeBranchLabel,
      businessDate: reportArg.filters.date || businessDate,
      cashier,
      labels: printLabels,
      report: reportArg,
      storeName,
    }),
    [activeBranchLabel, cashier, printLabels, storeName],
  );

  const previewData = useMemo(
    () => (report ? buildPrintData(report, appliedFilters.date) : null),
    [appliedFilters.date, buildPrintData, report],
  );

  // เมื่อรายการสาขาเปลี่ยน ให้ปรับ Filter เพื่อให้สาขาที่เลือกยังใช้งานได้
  useResetOnChange(normalizeBranchFilters, () => {
    setDraftFilters((current) => normalizeBranchFilters(current));
    setAppliedFilters((current) => normalizeBranchFilters(current));
  });

  const load = useCallback(async () => {
    if (!branchUuid || !appliedFilters.date) return false;

    try {
      await loadReport({
        branch_uuid_fk: branchUuid,
        date: appliedFilters.date,
        lang: language,
      });
      return true;
    } catch (loadError) {
      showToast({
        title: t("report.dailyClosing.loadFailed"),
        description: loadError instanceof Error ? loadError.message : "",
        tone: "error",
      });
      return false;
    }
  }, [appliedFilters.date, branchUuid, language, loadReport, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    const nextFilters = normalizeBranchFilters(draftFilters);
    const unchanged =
      nextFilters.branchUuid === appliedFilters.branchUuid &&
      nextFilters.date === appliedFilters.date;

    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);

    if (unchanged) void load();
  }

  async function printReport() {
    if (printDisabled) return;

    const printWindow = openReceiptPrintWindow();
    if (!printWindow) {
      showToast({
        title: t("report.printFailed"),
        description: t("report.printPopupBlocked"),
        tone: "error",
      });
      return;
    }

    setPrinting(true);
    try {
      const loaded = await load();
      if (!loaded) {
        printWindow.close();
        return;
      }

      const latestReport = useDailyStoreClosingReportStore.getState().report;
      if (!latestReport) throw new Error(t("report.noData"));

      renderReceiptPrintWindow(
        printWindow,
        renderDailyClosingPrintHtml(buildPrintData(latestReport, appliedFilters.date)),
      );
      showToast({
        title: t("report.printReady"),
        tone: "success",
      });
    } catch (printError) {
      printWindow.close();
      showToast({
        title: t("report.printFailed"),
        description: printError instanceof Error ? printError.message : "",
        tone: "error",
      });
    } finally {
      setPrinting(false);
    }
  }

  return {
    activeBranchAddress,
    activeBranchLabel,
    activeBranchTel,
    appliedFilters,
    balanced,
    branchError: branchSelectionError,
    branchLoading: branchSelectionLoading,
    branchOptions,
    branchUuid,
    canApply,
    canSelectBranch,
    draftFilters,
    error,
    itemCount,
    load,
    loading,
    paymentDifference,
    previewData,
    printDisabled,
    printReport,
    printing,
    report,
    reportTitle,
    setDraftFilters,
    storeName,
    applyFilters,
  };
}
