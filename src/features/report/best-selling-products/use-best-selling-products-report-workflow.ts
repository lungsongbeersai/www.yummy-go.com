"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useAppStore } from "@/stores/app-store";
import { useBestSellingProductsReportStore } from "@/stores/report-store";
import { useGroupStore } from "@/stores/group-store";
import { exportInfoRows } from "../shared/report-export-info";
import { useStandardReportWorkflow } from "../shared/use-standard-report-workflow";
import type { BestSellingExportData, BestSellingProductsFilters } from "./best-selling-products-report-types";
import {
  ALL_GROUPS_VALUE,
  bestSellingFileBaseName,
  bestSellingGroupedSection,
  bestSellingGroupsFromRows,
  bestSellingProductRowId,
  bestSellingSortLabel,
  bestSellingSummaryFromRows,
  bestSellingSummaryConfigs,
  exportSummaryRows,
  groupOptionFromRow,
  groupParam,
  selectedOptionLabel
} from "./best-selling-products-report-utils";

export function useBestSellingProductsReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState,
  // สถานะการแสดง summary cards ใน UI — ไฟล์ export ต้องมีส่วนสรุปตรงกับที่ผู้ใช้เห็น
  summaryVisible: boolean
) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const groupRows = useGroupStore((state) => state.rows);
  const groupError = useGroupStore((state) => state.error);
  const groupLoading = useGroupStore((state) => state.loading);
  const loadGroups = useGroupStore((state) => state.load);
  const groups = useBestSellingProductsReportStore((state) => state.groups);
  const rows = useBestSellingProductsReportStore((state) => state.rows);
  const summary = useBestSellingProductsReportStore((state) => state.summary);
  const loading = useBestSellingProductsReportStore((state) => state.loading);
  const error = useBestSellingProductsReportStore((state) => state.error);
  const total = useBestSellingProductsReportStore((state) => state.total);
  const totalPages = useBestSellingProductsReportStore((state) => state.totalPages);
  const loadReport = useBestSellingProductsReportStore((state) => state.load);
  const loadExportData = useBestSellingProductsReportStore((state) => state.loadExportData);

  const groupOptions = useMemo(() => {
    const options = groupRows
      .map((group) => groupOptionFromRow(group, language))
      .filter((option): option is NonNullable<typeof option> => Boolean(option));
    return [{ value: ALL_GROUPS_VALUE, label: t("common.all") }, ...options];
  }, [groupRows, language, t]);
  const groupOptionValues = useMemo(() => new Set(groupOptions.map((option) => option.value)), [groupOptions]);
  const summaryCards = useMemo(() => bestSellingSummaryConfigs(t), [t]);

  // รายงานนี้มี group filter เพิ่มจากรายงานอื่น จึงต้องรีเซ็ตกลุ่มที่หลุดจาก options (สลับร้าน/กลุ่มถูกลบ/
  // ยังโหลดกลุ่มไม่เสร็จ) กลับเป็น "ทั้งหมด" — ส่งเข้า useStandardReportWorkflow เป็น extraNormalize
  // (ต้อง useCallback เองเพราะ identity ของมันขับ reset effect ในฮุกกลาง เมื่อ groupOptionValues เปลี่ยน)
  const extraNormalize = useCallback(
    (filters: BestSellingProductsFilters): BestSellingProductsFilters => {
      const nextGroupUuid = groupOptionValues.has(filters.groupUuid) ? filters.groupUuid : ALL_GROUPS_VALUE;
      return filters.groupUuid === nextGroupUuid ? filters : { ...filters, groupUuid: nextGroupUuid };
    },
    [groupOptionValues]
  );

  // buildExcelWorkbook ต้องใช้ค่าที่คำนวณจากผลลัพธ์ของฮุกนี้เอง (activeBranchLabel ฯลฯ) — อ้างตรงๆ ในตัว
  // config ไม่ได้เพราะ TS อนุมาน type ของ "report" แบบวนกลับเข้าตัวเองไม่ได้ (runtime ปลอดภัยเพราะ closure
  // ถูกเรียกทีหลังเสมอ) จึงพักค่าไว้ใน ref แล้วอัปเดตผ่าน effect
  const excelContextRef = useRef({ activeBranchLabel: "", dateFrom: "", dateTo: "" });

  const report = useStandardReportWorkflow<
    BestSellingProductsFilters,
    (typeof rows)[number],
    Parameters<typeof loadReport>[0],
    Parameters<typeof loadExportData>[0],
    BestSellingExportData
  >({
    buildInitialFilters: ({ today, userBranchUuid, initialPagination: pagination }) => ({
      branchUuid: userBranchUuid,
      dateFrom: today,
      dateTo: today,
      groupUuid: ALL_GROUPS_VALUE,
      limit: pagination.limit,
      sortBy: "qty"
    }),
    extraNormalize,
    initialPagination,
    error,
    getRowId: bestSellingProductRowId,
    loading,
    rows,
    total,
    totalPages,
    visibleRowCount: rows.length,
    buildLoadParams: ({ branchUuid, filters, language: lang, page }) => ({
      branch_uuid_fk: branchUuid,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      group_uuid_fk: groupParam(filters.groupUuid),
      lang,
      limit: filters.limit,
      page,
      sort_by: filters.sortBy
    }),
    load: loadReport,
    loadFailedTitle: t("report.bestSelling.loadFailed"),
    exportReportRef,
    buildExportParams: ({ branchUuid, filters, language: lang }) => ({
      branch_uuid_fk: branchUuid,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      group_uuid_fk: groupParam(filters.groupUuid),
      lang,
      sort_by: filters.sortBy
    }),
    loadExportData,
    applySelection: (data, selection) => {
      if (!selection.selectedCount) return data;

      const selectedRows = data.rows.filter((row) =>
        selection.selectedRowIds.has(bestSellingProductRowId(row))
      );
      const selectedGroups = bestSellingGroupsFromRows(data.groups, selectedRows);

      return {
        ...data,
        groups: selectedGroups,
        rows: selectedRows,
        summary: bestSellingSummaryFromRows(selectedRows, selectedGroups.length)
      };
    },
    fileBaseName: bestSellingFileBaseName,
    buildExcelWorkbook: (XLSX, data) => {
      const context = excelContextRef.current;
      return createSingleSheetReportWorkbook(
        XLSX,
        [
          {
            title: t("report.excel.reportInformation"),
            rows: exportInfoRows(t, {
              branchLabel: context.activeBranchLabel,
              dateFrom: context.dateFrom,
              dateTo: context.dateTo
            })
          },
          ...(summaryVisible
            ? [
              {
                title: t("report.summary"),
                rows: exportSummaryRows(summaryCards, data.summary, t)
              }
            ]
            : []),
          bestSellingGroupedSection(data.groups, data.summary, t)
        ],
        officialReportExcelLayout(t, t("report.bestSelling.title"))
      );
    }
  });

  const activeGroupLabel = selectedOptionLabel(groupOptions, report.appliedFilters.groupUuid, t("common.all"));
  const activeBranchLabel = report.branchLabelFor(report.branchUuid);
  const sortByLabel = bestSellingSortLabel(report.appliedFilters.sortBy, t);
  const renderedExportData = report.exportData ?? { groups, rows, summary };

  // ห้ามเขียน ref ระหว่าง render (react-hooks/refs) — อัปเดตผ่าน effect แทน ยังปลอดภัยเพราะ
  // buildExcelWorkbook ถูกเรียกจากปุ่ม export เท่านั้น ซึ่งเกิดหลัง effect นี้รันเสมอ
  useEffect(() => {
    excelContextRef.current = {
      activeBranchLabel,
      dateFrom: report.appliedFilters.dateFrom,
      dateTo: report.appliedFilters.dateTo
    };
  });

  useEffect(() => {
    if (!report.storeUuid) return;
    void loadGroups({ lang: language, limit: "All", page: 1, store_uuid_fk: report.storeUuid }).catch(() => undefined);
  }, [language, loadGroups, report.storeUuid]);

  function applySortBy(sortBy: BestSellingProductsFilters["sortBy"]) {
    if (sortBy === report.appliedFilters.sortBy) return;
    const nextFilters = report.normalizeFilters({ ...report.appliedFilters, sortBy });
    report.setDraftFilters((current) => ({ ...current, sortBy: nextFilters.sortBy }));
    report.setAppliedFilters(nextFilters);
    report.setPage(1);
  }

  return {
    ...report,
    activeBranchLabel,
    activeGroupLabel,
    groupError,
    groupLoading,
    groupOptions,
    groups,
    renderedExportData,
    rows,
    sortByLabel,
    summary,
    summaryCards,
    applySortBy
  };
}
