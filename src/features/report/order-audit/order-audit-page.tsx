"use client";

import { BadgePercent, History, Info, ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OrderAuditDetailDrawer, OrderAuditDetailPanel } from "@/features/report/order-audit/components/order-audit-detail-panel";
import { OrderAuditFilterBar, OrderAuditFilterSheet } from "@/features/report/order-audit/components/order-audit-filter-sheet";
import { OrderAuditGroupListPanel } from "@/features/report/order-audit/components/order-audit-group-list";
import { ReportError } from "@/features/report/shared/report-error";
import {
  ReportMobileFilterBar,
  ReportPage,
  ReportRefreshButton,
  ReportResultArea,
  ReportSummaryToggle,
  ReportToolbar,
} from "@/features/report/shared/report-layout";
import { ReportStatCards } from "@/features/report/shared/report-stat-cards";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useOrderAuditPage } from "./use-order-audit-page";

const SUMMARY_ID = "order-audit-summary";

export function OrderAuditPage() {
  const user = useAuthStore((state) => state.user);
  // สร้าง state ตัวกรอง/รายละเอียดใหม่เมื่อร้าน สาขา หรือสิทธิ์ของผู้ใช้เปลี่ยน
  return <OrderAuditReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

// โครงเดียวกับรายงานหน้าอื่น (shared/report-layout.tsx) — ผลลัพธ์เป็นรายการเหตุการณ์ + รายละเอียด
// สองแผงในกรอบเดียว (แบบ sales-list) แทนตาราง จอเล็กกว่า xl เปิดรายละเอียดเป็น drawer
function OrderAuditReport() {
  const { t } = useTranslation();
  const page = useOrderAuditPage();
  const controlsDisabled = page.loading;
  const summary = page.current?.summary;

  const filterFieldProps = {
    branchLoading: page.scope.branchLoading,
    branchLocked: !page.scope.canSelectBranch,
    branchOptions: page.scope.branchOptions,
    actionOptions: page.actionOptions,
    entityOptions: page.entityOptions,
    draft: page.draft,
    draftBranch: page.draftBranch,
    onDraftChange: page.setDraft,
  };
  const errors = [!page.branchUuid ? t("report.branchRequired") : null, page.scope.branchError, page.error].filter(
    (message): message is string => Boolean(message),
  );
  const refreshButton = (
    <ReportRefreshButton disabled={controlsDisabled} loading={page.loading} onRefresh={page.refresh} />
  );

  return (
    <>
      <ReportPage title={t("orderAudit.title")}>
        <ReportMobileFilterBar
          dateFrom={page.applied.dateFrom}
          dateTo={page.applied.dateTo}
          disabled={controlsDisabled}
          refreshButton={refreshButton}
          onOpenFilters={() => page.setMobileFilterOpen(true)}
        />
        <OrderAuditFilterBar
          actions={refreshButton}
          canApply={page.valid}
          loading={page.loading}
          onApply={page.apply}
          {...filterFieldProps}
        />
        <OrderAuditFilterSheet
          canApply={page.valid}
          dateRangeInvalid={!page.dateRangeValid}
          loading={page.loading}
          open={page.mobileFilterOpen}
          onApply={page.apply}
          onOpenChange={(open) => {
            if (!open) page.setDraft(page.applied);
            page.setMobileFilterOpen(open);
          }}
          {...filterFieldProps}
        />

        {errors.map((message) => (
          <ReportError key={message} message={message} />
        ))}

        <ReportToolbar
          title={t("orderAudit.title")}
          actions={
            <ReportSummaryToggle
              controlsId={SUMMARY_ID}
              visible={page.summaryVisible}
              onToggle={() => page.setSummaryVisible((visible) => !visible)}
            />
          }
        />

        {page.summaryVisible ? (
          <div id={SUMMARY_ID} className="flex shrink-0 flex-col gap-4">
            {summary ? (
              <ReportStatCards
                className="lg:grid-cols-3"
                stats={[
                  { icon: History, key: "events", label: t("orderAudit.stats.events"), tone: "info", value: summary.event_count.toLocaleString("en-US") },
                  { icon: ReceiptText, key: "bills", label: t("orderAudit.stats.bills"), tone: "primary", value: summary.bill_count.toLocaleString("en-US") },
                  { icon: BadgePercent, key: "discounts", label: t("orderAudit.stats.discountChanges"), tone: "warning", value: summary.discount_count.toLocaleString("en-US") },
                ]}
              />
            ) : null}
            <Alert>
              <Info />
              <AlertDescription>{t("orderAudit.historyNotice")}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        {page.loading && !page.groups.length ? (
          <ReportResultArea>
            <LoadingState label={t("common.loading")} variant="splitPanel" />
          </ReportResultArea>
        ) : (
          <ReportResultArea framed className="xl:grid xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
            <OrderAuditGroupListPanel
              eventCount={page.groups.length}
              groups={page.groups}
              language={page.language}
              loading={page.loading}
              page={page.current?.pagination.page ?? 1}
              rangeLabel={page.rangeLabel}
              selectedGroupId={page.selectedGroupId}
              totalPages={page.current?.pagination.total_pages ?? 1}
              onPageChange={page.goToPage}
              onSelect={page.selectGroup}
            />
            <OrderAuditDetailPanel
              branchLabel={page.branchLabel}
              className="hidden xl:flex"
              group={page.selectedGroup}
              language={page.language}
            />
          </ReportResultArea>
        )}
      </ReportPage>

      <OrderAuditDetailDrawer
        branchLabel={page.branchLabel}
        group={page.selectedGroup}
        language={page.language}
        open={page.mobileDetailOpen}
        onOpenChange={page.setMobileDetailOpen}
      />
    </>
  );
}
