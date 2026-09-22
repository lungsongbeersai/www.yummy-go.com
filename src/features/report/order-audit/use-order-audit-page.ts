"use client";

import { useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { ORDER_AUDIT_ACTIONS } from "@/config/order-audit";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { useOrderAuditReportStore } from "@/stores/report-store";
import type { OrderAuditDraft } from "./components/order-audit-filter-sheet";
import { groupOrderAuditRows } from "./order-audit-grouping";
import { auditToday, validAuditDateRange } from "./order-audit-utils";

const ORDER_AUDIT_DESKTOP_MEDIA_QUERY = "(min-width: 1280px)";

function shouldOpenMobileEventDetail() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia(ORDER_AUDIT_DESKTOP_MEDIA_QUERY).matches;
}

export function useOrderAuditPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useOrderAuditReportStore();
  const isDesktop = useMediaQuery(ORDER_AUDIT_DESKTOP_MEDIA_QUERY);
  const [draft, setDraft] = useState<OrderAuditDraft>(() => ({
    branchUuid: scope.defaultBranchUuid,
    dateFrom: auditToday(), dateTo: auditToday(), search: "", action: "all", entity: "all",
  }));
  const [applied, setApplied] = useState(draft);
  const [paging, setPaging] = useState({ page: 1, snapshot: "", refresh: 0, scope: scope.defaultBranchUuid });
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = validAuditDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;

  useEffect(() => {
    if (!branchUuid) return;
    void load({ branch_uuid_fk: branchUuid, date_from: applied.dateFrom, date_to: applied.dateTo,
      search: applied.search, action: applied.action === "all" ? "" : applied.action,
      entity_type: applied.entity === "all" ? "" : applied.entity,
      page: paging.scope === branchUuid ? paging.page : 1, limit: 20,
      snapshot_id: paging.scope === branchUuid ? paging.snapshot || undefined : undefined,
      lang: language }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.dateFrom, applied.dateTo, applied.search,
    applied.action, applied.entity, paging.page, paging.snapshot, paging.refresh, paging.scope, language]);

  // ไม่เปิดเผยรายละเอียดค้างจาก scope เก่าระหว่างที่ request ใหม่เริ่มโหลด
  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo &&
    report.rows.every(row => row.store_uuid_fk === scope.storeUuid) ? report : null;
  const groups = useMemo(() => groupOrderAuditRows(current?.rows ?? []), [current]);
  const selectedGroup = groups.find(group => group.id === selectedGroupId) ?? null;
  const rangeLabel = current ? t("common.showingRange", {
    start: (current.pagination.page - 1) * current.pagination.limit + 1,
    end: Math.min(current.pagination.page * current.pagination.limit, current.pagination.total),
    total: current.pagination.total,
  }) : "";
  const actionOptions = [{ value: "all", label: t("orderAudit.all") },
    ...ORDER_AUDIT_ACTIONS.map(value => ({ value, label: t(`orderAudit.actions.${value}`) }))];
  const entityOptions = [{ value: "all", label: t("orderAudit.all") },
    ...["ORDER", "ITEM", "TOPPING", "PAYMENT"].map(value => ({ value, label: t(`orderAudit.entities.${value}`) }))];

  // แผงรายละเอียดที่เปิดอยู่หายไป (หน้า/ตัวกรองเปลี่ยน) = ปิดแผงมือถือ
  useResetOnDeps([mobileDetailOpen, selectedGroup], () => {
    if (mobileDetailOpen && !selectedGroup) setMobileDetailOpen(false);
  });

  // ปิดแผงมือถือเมื่อจอ "ข้าม" เป็น desktop — ไม่ derive จากค่า isDesktop ตรงๆ
  // เพราะย่อจอกลับมา mobile แล้วแผงต้องไม่เด้งเปิดเอง (แพตเทิร์นเดียวกับ sales-list)
  useResetOnDeps([isDesktop], () => {
    if (isDesktop) setMobileDetailOpen(false);
  });

  function apply() {
    if (!valid || loading) return;
    setSelectedGroupId("");
    setApplied({ ...draft, branchUuid: draftBranch });
    setPaging(previous => ({ page: 1, snapshot: "", refresh: previous.refresh + 1, scope: draftBranch }));
    setMobileFilterOpen(false);
  }

  function refresh() {
    setSelectedGroupId("");
    setPaging(previous => ({ ...previous, page: 1, snapshot: "", refresh: previous.refresh + 1, scope: branchUuid }));
  }

  function goToPage(targetPage: number) {
    if (!current) return;
    setSelectedGroupId("");
    setPaging(previous => ({ ...previous, page: targetPage, snapshot: current.pagination.snapshot_id, scope: branchUuid }));
  }

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId);
    if (shouldOpenMobileEventDetail()) setMobileDetailOpen(true);
  }

  return {
    actionOptions,
    applied,
    apply,
    branchLabel: scope.branchLabelFor(branchUuid),
    branchUuid,
    current,
    draft,
    draftBranch,
    dateRangeValid,
    entityOptions,
    error,
    goToPage,
    groups,
    language,
    loading,
    mobileDetailOpen,
    mobileFilterOpen,
    rangeLabel,
    refresh,
    scope,
    selectedGroup,
    selectedGroupId,
    selectGroup,
    setDraft,
    setMobileDetailOpen,
    setMobileFilterOpen,
    setSummaryVisible,
    summaryVisible,
    valid,
  };
}
