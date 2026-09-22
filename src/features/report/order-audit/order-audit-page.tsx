"use client";

import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OrderAuditDetailDrawer, OrderAuditDetailPanel } from "@/features/report/order-audit/components/order-audit-detail-panel";
import { OrderAuditFilterBar, OrderAuditFilterSheet } from "@/features/report/order-audit/components/order-audit-filter-sheet";
import { OrderAuditGroupListPanel } from "@/features/report/order-audit/components/order-audit-group-list";
import { ReportPageShell } from "@/features/report/shared/report-page-shell";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useOrderAuditPage } from "./use-order-audit-page";

const SUMMARY_ID = "order-audit-summary";

export function OrderAuditPage() {
  const user = useAuthStore((state) => state.user);
  // สร้าง state ตัวกรอง/รายละเอียดใหม่เมื่อร้าน สาขา หรือสิทธิ์ของผู้ใช้เปลี่ยน
  return <OrderAuditReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function OrderAuditReport() {
  const { t } = useTranslation();
  const page = useOrderAuditPage();

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

  return (
    <>
      <ReportPageShell
        accessibleTitle={t("orderAudit.title")}
        variant="compact"
        dateFrom={page.applied.dateFrom}
        dateTo={page.applied.dateTo}
        loading={page.loading}
        exporting={false}
        exportingTitle=""
        errors={[
          !page.branchUuid ? t("report.branchRequired") : null,
          page.scope.branchError,
          page.error,
        ]}
        inlineFilters={actions => (
          <OrderAuditFilterBar
            actions={actions}
            canApply={page.valid}
            loading={page.loading}
            onApply={page.apply}
            {...filterFieldProps}
          />
        )}
        filterSheet={
          <OrderAuditFilterSheet
            canApply={page.valid}
            dateRangeInvalid={!page.dateRangeValid}
            loading={page.loading}
            open={page.mobileFilterOpen}
            onApply={page.apply}
            onOpenChange={open => { if (!open) page.setDraft(page.applied); page.setMobileFilterOpen(open); }}
            {...filterFieldProps}
          />
        }
        summaryCardsId={SUMMARY_ID}
        summaryVisible={page.summaryVisible}
        onToggleSummary={() => page.setSummaryVisible(visible => !visible)}
        summary={
          <div className="flex flex-col gap-2">
            <Alert><AlertDescription>{t("orderAudit.historyNotice")}</AlertDescription></Alert>
            {page.current ? <p className="text-sm text-muted-foreground">{t("orderAudit.summary", page.current.summary)}</p> : null}
          </div>
        }
        onOpenFilters={() => page.setMobileFilterOpen(true)}
        onRefresh={page.refresh}
        table={
          page.loading && !page.groups.length ? (
            <div className="min-w-0 flex-1 p-3">
              <LoadingState label={t("common.loading")} variant="splitPanel" />
            </div>
          ) : (
            <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
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
            </div>
          )
        }
      />

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
