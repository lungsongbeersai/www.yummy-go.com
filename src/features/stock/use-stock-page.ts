"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { Category } from "@/services/category";
import type { StockStatus } from "@/services/stock";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useStockStore } from "@/stores/stock-store";
import { useToastStore } from "@/stores/toast-store";
import {
  categoryOptionName,
  categoryUuid,
} from "@/features/product/list/product-list-utils";
import {
  branchOptionFromRow,
  localDateInputValue,
  selectedBranchLabel,
} from "@/features/sales/sales-list/sales-list-utils";
import { waitForPaint } from "@/features/report/daily-sales/daily-sales-report-export-utils";
import { createSingleSheetReportWorkbook } from "@/features/report/report-excel-utils";
import { officialReportExcelLayout } from "@/features/report/report-official-layout";
import { addReportCanvasToPdfPages } from "@/features/report/report-pdf-utils";
import {
  flattenStockExportRows,
  stockExcelRows,
  stockExportFileBaseName,
  stockExportInfoRows,
  type StockExportRow,
} from "./stock-export-utils";
import { STOCK_PAGE_LIMIT_OPTIONS } from "./stock-constants";
import { stockStatusTranslationKey } from "./stock-utils";

export type StockExportAction = "excel" | "pdf";

const ALL_CATEGORIES = "all";
const STOCK_LIMIT_OPTIONS = [...STOCK_PAGE_LIMIT_OPTIONS];
const EMPTY_CATEGORIES: Category[] = [];

export interface StockCategoryOption {
  label: string;
  value: string;
}

export interface StockBranchOption {
  label: string;
  value: string;
}

export function useStockPage(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState,
) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const userBranchUuid = user?.branch_uuid ?? "";
  // เฉพาะแอดมิน (status = 1) เท่านั้นที่เลือกดูสาขาอื่นได้ — pattern เดียวกับหน้า sales/report
  const canSelectBranch = Number(user?.status ?? 0) === 1;
  const storeUuid = authStoreUuid(user);
  const language = useAppStore((state) => state.language);
  const branches = useBranchStore((state) => state.branches);
  const branchLoading = useBranchStore((state) => state.loading);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const loadBranches = useBranchStore((state) => state.loadBranches);
  const selectedBranchUuid = useBranchStore((state) => state.selectedBranchUuid);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const rows = useStockStore((state) => state.rows);
  const total = useStockStore((state) => state.total);
  const totalPages = useStockStore((state) => state.totalPages);
  const loading = useStockStore((state) => state.loading);
  const error = useStockStore((state) => state.error);
  const loadStock = useStockStore((state) => state.load);
  const loadStockExport = useStockStore((state) => state.loadExport);
  const resetStock = useStockStore((state) => state.reset);
  const showToast = useToastStore((state) => state.show);
  const categories = (useReferenceStore(
    (state) => state.options.categories,
  ) ?? EMPTY_CATEGORIES) as Category[];
  const categoryLoading = Boolean(
    useReferenceStore((state) => state.loadingKeys.categories),
  );
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [status, setStatus] = useState<StockStatus>("all");
  const [exporting, setExporting] = useState<StockExportAction | null>(null);
  // แถวที่ render ลง export surface ระหว่างทำ PDF เท่านั้น
  const [exportRows, setExportRows] = useState<StockExportRow[]>([]);
  const { changeLimit, goToPage, limit, page, resetPage } = useUrlPagination({
    initialPagination,
    limitOptions: STOCK_LIMIT_OPTIONS,
  });
  const pageLimit =
    typeof limit === "number" ? limit : STOCK_PAGE_LIMIT_OPTIONS[0];
  const safeTotalPages = Math.max(1, totalPages);
  const pageStart = rows.length ? (page - 1) * pageLimit + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;

  const categoryOptions = useMemo<StockCategoryOption[]>(
    () =>
      categories.flatMap((item) => {
        const value = categoryUuid(item);
        return value
          ? [{ value, label: categoryOptionName(item, language) }]
          : [];
      }),
    [categories, language],
  );

  const branchOptions = useMemo<StockBranchOption[]>(() => {
    const storeBranches = branchStoreUuid === storeUuid ? branches : [];
    const options = storeBranches
      .map((branch) => branchOptionFromRow(branch, language))
      .filter((option): option is StockBranchOption => Boolean(option));

    if (
      userBranchUuid &&
      !options.some((option) => option.value === userBranchUuid)
    ) {
      options.unshift({
        value: userBranchUuid,
        label: user?.branch_name || userBranchUuid,
      });
    }

    if (canSelectBranch) return options;

    // ผู้ใช้ทั่วไปถูกล็อกไว้ที่สาขาตัวเอง
    const lockedOptions = options.filter(
      (option) => option.value === userBranchUuid,
    );
    return lockedOptions.length || !userBranchUuid
      ? lockedOptions
      : [{ value: userBranchUuid, label: user?.branch_name || userBranchUuid }];
  }, [
    branches,
    branchStoreUuid,
    canSelectBranch,
    language,
    storeUuid,
    user?.branch_name,
    userBranchUuid,
  ]);
  const branchOptionValues = useMemo(
    () => new Set(branchOptions.map((option) => option.value)),
    [branchOptions],
  );
  const branchStoreSelectedUuid =
    branchStoreUuid === storeUuid ? selectedBranchUuid : "";
  const branchUuid = useMemo(() => {
    if (!canSelectBranch) return userBranchUuid;
    if (
      branchStoreSelectedUuid &&
      (!branchOptionValues.size ||
        branchOptionValues.has(branchStoreSelectedUuid))
    ) {
      return branchStoreSelectedUuid;
    }
    if (
      userBranchUuid &&
      (!branchOptionValues.size || branchOptionValues.has(userBranchUuid))
    ) {
      return userBranchUuid;
    }
    return branchOptions[0]?.value ?? userBranchUuid;
  }, [
    branchOptionValues,
    branchOptions,
    branchStoreSelectedUuid,
    canSelectBranch,
    userBranchUuid,
  ]);
  const branchName = selectedBranchLabel(
    branchOptions,
    branchUuid,
    user?.branch_name ?? "",
  );

  const load = useCallback(async () => {
    if (!branchUuid) return;

    try {
      await loadStock({
        branch_uuid_fk: branchUuid,
        category_fk: category,
        stock_status: status,
        page,
        limit: pageLimit,
        lang: language,
      });
      const loadedTotalPages = Math.max(
        1,
        useStockStore.getState().totalPages,
      );
      if (page > loadedTotalPages) goToPage(loadedTotalPages);
    } catch {
      // The store keeps the request error so the page can offer an inline retry.
    }
  }, [
    branchUuid,
    category,
    language,
    loadStock,
    goToPage,
    page,
    pageLimit,
    status,
  ]);

  useEffect(() => {
    if (!storeUuid) return;
    void loadCategories(language, storeUuid).catch(() => undefined);
  }, [language, loadCategories, storeUuid]);

  useEffect(() => {
    if (!storeUuid || !canSelectBranch) return;
    void loadBranches(storeUuid, userBranchUuid).catch(() => undefined);
  }, [canSelectBranch, loadBranches, storeUuid, userBranchUuid]);

  useEffect(() => {
    if (!branchUuid) {
      resetStock();
      return;
    }
    void load();
  }, [branchUuid, load, resetStock]);

  function changeBranch(value: string) {
    if (!value || value === branchUuid) return;
    setSelectedBranch(value);
    resetPage();
  }

  function changeCategory(value: string) {
    if (value === category) return;
    setCategory(value || ALL_CATEGORIES);
    resetPage();
  }

  function changeStatus(value: StockStatus) {
    if (value === status) return;
    setStatus(value);
    resetPage();
  }

  function changePageLimit(value: number) {
    if (value === pageLimit || !STOCK_PAGE_LIMIT_OPTIONS.includes(value)) return;
    changeLimit(value);
  }

  const exportDisabled =
    loading || Boolean(exporting) || !branchUuid || !rows.length;
  const activeCategoryLabel =
    category === ALL_CATEGORIES
      ? t("stock.filters.allCategories")
      : (categoryOptions.find((option) => option.value === category)?.label ??
        category);
  const activeStatusLabel = t(stockStatusTranslationKey(status));
  const exportDateLabel = localDateInputValue();

  // ดึงข้อมูลทุกหน้าตาม filter ปัจจุบัน แล้วแบนราบเป็นแถวสินค้า × ขนาด
  async function fetchExportRows() {
    const data = await loadStockExport({
      branch_uuid_fk: branchUuid,
      category_fk: category,
      stock_status: status,
      page: 1,
      limit: Math.max(total, rows.length, 1),
      lang: language,
    });
    return flattenStockExportRows(data, language, t);
  }

  async function exportExcel() {
    if (exportDisabled) return;
    setExporting("excel");
    try {
      const flatRows = await fetchExportRows();
      const XLSX = await import("xlsx-js-style");
      const workbook = createSingleSheetReportWorkbook(
        XLSX,
        [
          {
            title: t("report.excel.reportInformation"),
            rows: stockExportInfoRows(t, {
              branchLabel: branchName || branchUuid,
              categoryLabel: activeCategoryLabel,
              statusLabel: activeStatusLabel,
              dateLabel: exportDateLabel,
            }),
          },
          { title: t("stock.title"), rows: stockExcelRows(flatRows, t) },
        ],
        officialReportExcelLayout(t, t("stock.title")),
      );
      XLSX.writeFile(
        workbook,
        `${stockExportFileBaseName(status, exportDateLabel)}.xlsx`,
      );
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: flatRows.length }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("report.exportFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    if (exportDisabled) return;
    setExporting("pdf");
    try {
      const flatRows = await fetchExportRows();
      setExportRows(flatRows);
      await waitForPaint();

      const element = exportReportRef.current;
      if (!element) throw new Error(t("report.exportFailed"));

      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvasModule.default(element, {
        backgroundColor: "#ffffff",
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        windowHeight: element.scrollHeight,
        windowWidth: element.scrollWidth,
      });
      const pdf = new jsPDF({
        format: "a4",
        orientation: "landscape",
        unit: "pt",
      });
      addReportCanvasToPdfPages(pdf, canvas, element);

      pdf.save(`${stockExportFileBaseName(status, exportDateLabel)}.pdf`);
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: flatRows.length }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("report.exportFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setExporting(null);
      setExportRows([]);
    }
  }

  return {
    t,
    branchLoading,
    branchName,
    branchOptions,
    branchUuid,
    canSelectBranch,
    language,
    rows,
    total,
    totalPages: safeTotalPages,
    loading,
    error,
    category,
    categoryLoading,
    categoryOptions,
    activeCategoryLabel,
    activeStatusLabel,
    exportDateLabel,
    exportDisabled,
    exportExcel,
    exportPdf,
    exportRows,
    exporting,
    status,
    page,
    pageLimit,
    pageStart,
    pageEnd,
    changeBranch,
    changeCategory,
    changeStatus,
    changePageLimit,
    goToPage,
    refresh: load,
  };
}

export type StockPageWorkflow = ReturnType<typeof useStockPage>;
