"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { localDateInputValue } from "@/lib/format";
import { pageLimitSize } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useAppStore } from "@/stores/app-store";
import { useBranchStore } from "@/stores/branch-store";
import { useToastStore } from "@/stores/toast-store";
import {
  useReportRowSelection,
  type UseReportRowSelectionResult,
} from "./report-row-selection";
import { useReportBranchSelection } from "./use-report-branch-selection";
import {
  useReportExportActions,
  type ReportExportAction,
} from "./use-report-export-actions";

type XlsxModule = typeof import("xlsx-js-style");

export interface StandardReportFiltersBase {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  limit: import("@/services/shared/types").PageLimit;
}

export interface StandardReportWorkflowConfig<
  Filters extends StandardReportFiltersBase,
  Row,
  LoadParams,
  ExportParams,
  ExportData extends { rows: unknown[] }
> {
  // filters — เรียกครั้งเดียวตอน mount ผ่าน useState lazy initializer จึงไม่ต้อง memo
  buildInitialFilters: (context: {
    initialPagination: UrlPaginationState;
    today: string;
    userBranchUuid: string;
  }) => Filters;
  // normalize เพิ่มเติมนอกเหนือจากสาขา เช่น best-selling ต้อง reset groupUuid ที่หลุดจาก options —
  // ต้อง useCallback จากผู้เรียกเองถ้าอ้างค่าที่เปลี่ยนได้ (ดู normalizeBranchFilters composition ด้านล่าง)
  extraNormalize?: (filters: Filters) => Filters;

  initialPagination: UrlPaginationState;

  // ข้อมูลแถว/สถานะโหลดจาก Zustand store ของแต่ละรายงาน (เลือกด้วย selector ที่ต้นทางเอง)
  error: string | null;
  getRowId: (row: Row) => string;
  loading: boolean;
  rows: Row[];
  total: number;
  totalPages: number;
  // จำนวนแถวที่ "เห็นจริง" ต่อหน้า ใช้คำนวณช่วง page — ปกติคือ rows.length แต่ category-sales
  // นับเป็นจำนวนกลุ่มแทน จึงแยกออกมาให้ผู้เรียกกำหนด
  visibleRowCount: number;

  // โหลดรายงาน (เรียกอัตโนมัติเมื่อ appliedFilters/branchUuid/page/language เปลี่ยน)
  buildLoadParams: (args: {
    branchUuid: string;
    filters: Filters;
    language: string;
    page: number;
  }) => LoadParams;
  load: (params: LoadParams) => Promise<unknown>;
  loadFailedTitle: string;

  // export excel/pdf/print
  exportReportRef: RefObject<HTMLDivElement | null>;
  buildExportParams: (args: {
    branchUuid: string;
    filters: Filters;
    language: string;
  }) => ExportParams;
  loadExportData: (params: ExportParams) => Promise<ExportData>;
  // ตัดข้อมูล export ให้เหลือเฉพาะแถวที่ผู้ใช้ติ๊กเลือกไว้ (ถ้ามี) — สร้าง groups/summary/cards ใหม่ตามรายงาน
  applySelection: (
    data: ExportData,
    selection: { selectedCount: number; selectedRowIds: Set<string> }
  ) => ExportData;
  fileBaseName: (filters: Filters) => string;
  buildExcelWorkbook: (
    XLSX: XlsxModule,
    data: ExportData
  ) => ReturnType<XlsxModule["utils"]["book_new"]>;
}

export interface StandardReportWorkflowResult<
  Filters extends StandardReportFiltersBase,
  Row,
  ExportData
> {
  appliedFilters: Filters;
  branchError: string | null;
  branchLabelFor: (branchUuid: string) => string;
  branchLoading: boolean;
  branchOptions: { label: string; value: string }[];
  branchUuid: string;
  canApply: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  canSelectBranch: boolean;
  defaultBranchUuid: string;
  draftFilters: Filters;
  error: string | null;
  exportData: ExportData | null;
  exportDisabled: boolean;
  exporting: ReportExportAction | null;
  loading: boolean;
  mobileFilterOpen: boolean;
  normalizeFilters: (filters: Filters) => Filters;
  page: number;
  paginationRangeLabel: string;
  rowSelection: UseReportRowSelectionResult<Row>;
  setAppliedFilters: Dispatch<SetStateAction<Filters>>;
  setDraftFilters: Dispatch<SetStateAction<Filters>>;
  setPage: (page: number | ((current: number) => number)) => void;
  storeUuid: string;
  totalPages: number;
  applyFilters: () => void;
  applyMobileFilters: () => void;
  exportExcel: () => Promise<void>;
  exportPdf: () => Promise<void>;
  handleMobileFilterOpenChange: (open: boolean) => void;
  load: () => Promise<void>;
  openMobileFilters: () => void;
  printReport: () => Promise<void>;
}

// รวม orchestration ที่ทุกหน้ารายงาน (payment-methods/category-sales/best-selling ฯลฯ) ทำเหมือนกัน
// เกือบทั้งหมด: draft/applied filters + normalize ตามสาขา, apply (desktop/mobile), auto-load ตาม filters
// ที่ใช้จริง, pagination label, row selection, และ export excel/pdf/print — ส่วนที่ต่างกันจริงต่อรายงาน
// (การ build params, การสร้างไฟล์ excel, การตัดข้อมูลตามแถวที่เลือก ฯลฯ) รับเข้ามาเป็น config
// เดิม flow นี้ถูกก๊อปวางไว้เกือบทั้งบรรทัดในทุก use-*-report-workflow (~90% ซ้ำกัน)
export function useStandardReportWorkflow<
  Filters extends StandardReportFiltersBase,
  Row,
  LoadParams,
  ExportParams,
  ExportData extends { rows: unknown[] }
>(
  config: StandardReportWorkflowConfig<Filters, Row, LoadParams, ExportParams, ExportData>
): StandardReportWorkflowResult<Filters, Row, ExportData> {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const {
    branchError,
    branchLabelFor,
    branchLoading,
    branchOptions,
    canSelectBranch,
    defaultBranchUuid,
    normalizeBranchFilters,
    storeUuid,
    userBranchUuid,
  } = useReportBranchSelection();

  const [draftFilters, setDraftFilters] = useState<Filters>(() =>
    config.buildInitialFilters({
      initialPagination: config.initialPagination,
      today,
      userBranchUuid,
    })
  );
  const [appliedFilters, setAppliedFilters] = useState<Filters>(draftFilters);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { changeLimit, page, setPage } = useUrlPagination({
    initialPagination: config.initialPagination,
  });
  const rowSelection = useReportRowSelection({
    getRowId: config.getRowId,
    rows: config.rows,
  });

  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const canApply = Boolean(draftFilters.branchUuid || defaultBranchUuid);
  const activePageLimit = pageLimitSize(appliedFilters.limit, config.visibleRowCount);
  const pageStart = config.total ? (page - 1) * activePageLimit + 1 : 0;
  const pageEnd = config.total
    ? Math.min((page - 1) * activePageLimit + config.visibleRowCount, config.total)
    : 0;
  const canGoBack = page > 1 && !config.loading;
  const canGoNext = page < config.totalPages && !config.loading;
  const paginationRangeLabel = t("common.showingRange", {
    start: pageStart,
    end: pageEnd,
    total: config.total,
  });

  // ต้องอ่าน config ล่าสุดเสมอโดยไม่ทำให้ effect ที่พึ่ง `load`/`normalizeFilters` รันซ้ำทุกครั้งที่ re-render
  // (config เป็น object ใหม่ทุก render จากฝั่งผู้เรียก) — ค่าที่ "ควร" กระตุ้นการรันซ้ำจริงๆ อยู่ใน deps ตรงๆ แล้ว
  // อัปเดตผ่าน effect (ห้ามเขียน ref ระหว่าง render) — เรียงไว้ก่อน effect ที่ยิง load() เสมอ
  // เพื่อให้ load() เห็น config ล่าสุดในทุก commit เดียวกัน
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  // ตั้งใจอ้าง config.extraNormalize ตรงๆ (ไม่ผ่าน configRef) เพื่อให้ identity ของ normalizeFilters
  // เปลี่ยนตามจริงเมื่อ extraNormalize เปลี่ยน — useResetOnChange ด้านล่างพึ่ง identity นี้เป็น "key"
  // รีเซ็ต filters (เช่น best-selling ต้องรีเซ็ตเมื่อ groupOptionValues เปลี่ยน)
  const { extraNormalize } = config;
  const normalizeFilters = useCallback(
    (filters: Filters) => {
      const extraFilters = extraNormalize ? extraNormalize(filters) : filters;
      return normalizeBranchFilters(extraFilters) ?? extraFilters;
    },
    [normalizeBranchFilters, extraNormalize],
  );

  // รายการสาขาเปลี่ยน (โหลดเสร็จ/สลับร้าน) หรือเงื่อนไข normalize เฉพาะรายงานเปลี่ยน = ปรับ filters ให้ยังใช้ได้เสมอ
  useResetOnChange(normalizeFilters, () => {
    setDraftFilters((current) => normalizeFilters(current));
    setAppliedFilters((current) => normalizeFilters(current));
  });

  const load = useCallback(async () => {
    if (!branchUuid) return;

    try {
      await configRef.current.load(
        configRef.current.buildLoadParams({ branchUuid, filters: appliedFilters, language, page })
      );
    } catch (error) {
      showToast({
        title: configRef.current.loadFailedTitle,
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [appliedFilters, branchUuid, language, page, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    const nextFilters = normalizeFilters(draftFilters);
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    changeLimit(nextFilters.limit);
  }

  function openMobileFilters() {
    setDraftFilters({ ...appliedFilters });
    setMobileFilterOpen(true);
  }

  function handleMobileFilterOpenChange(open: boolean) {
    setMobileFilterOpen(open);
    if (!open) setDraftFilters({ ...appliedFilters });
  }

  function applyMobileFilters() {
    const nextFilters = normalizeFilters(draftFilters);
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    changeLimit(nextFilters.limit);
    setMobileFilterOpen(false);
  }

  async function fetchExportData(): Promise<ExportData> {
    if (!branchUuid) throw new Error(t("report.branchRequired"));

    const data = await config.loadExportData(
      config.buildExportParams({ branchUuid, filters: appliedFilters, language })
    );
    return config.applySelection(data, {
      selectedCount: rowSelection.selectedCount,
      selectedRowIds: rowSelection.selectedRowIds,
    });
  }

  const exportActions = useReportExportActions<ExportData>({
    disabled: config.loading || !branchUuid || !config.rows.length,
    exportReportRef: config.exportReportRef,
    fetchExportData,
    fileBaseName: () => config.fileBaseName(appliedFilters),
    buildExcelWorkbook: config.buildExcelWorkbook,
  });

  return {
    appliedFilters,
    branchError,
    branchLabelFor,
    branchLoading,
    branchOptions,
    branchUuid,
    canApply,
    canGoBack,
    canGoNext,
    canSelectBranch,
    defaultBranchUuid,
    draftFilters,
    error: config.error,
    exportData: exportActions.exportData,
    exportDisabled: exportActions.exportDisabled,
    exporting: exportActions.exporting,
    loading: config.loading,
    mobileFilterOpen,
    normalizeFilters,
    page,
    paginationRangeLabel,
    rowSelection,
    setAppliedFilters,
    setDraftFilters,
    setPage,
    storeUuid,
    totalPages: config.totalPages,
    applyFilters,
    applyMobileFilters,
    exportExcel: exportActions.exportExcel,
    exportPdf: exportActions.exportPdf,
    handleMobileFilterOpenChange,
    load,
    openMobileFilters,
    printReport: exportActions.printReport,
  };
}
