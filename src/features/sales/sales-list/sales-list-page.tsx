"use client";

import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { SalesBillDetailDrawer, SalesBillDetailPanel } from "./sales-bill-detail";
import { SalesBillListPanel } from "./sales-bill-list";
import { SalesListFilterBar, SalesListFilterSheet, SalesListHeader } from "./sales-list-filters";
import { SalesListSummaryCards } from "./sales-list-summary-cards";
import { firstNumber } from "./sales-list-utils";
import { useSalesListPage } from "./use-sales-list-page";

const SALES_LIST_SUMMARY_CARDS_ID = "sales-list-summary-cards";

export function SalesListPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const page = useSalesListPage(initialPagination);

  return (
    // เต็มหน้าจอแบบ /settings/store: ไม่มี padding รอบนอก และไม่จำกัดความกว้างกลางจออีก
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <div className="shrink-0 border-b border-border bg-card px-2 py-2 sm:px-3 lg:hidden">
        <SalesListHeader
          appliedFilters={page.appliedFilters}
          branchLabel={page.branchLabel}
          branchLoading={page.branchLoading}
          branchOptions={page.branchOptions}
          canApply={page.canApply}
          draftFilters={page.draftFilters}
          loading={page.loading}
          summaryControlsId={SALES_LIST_SUMMARY_CARDS_ID}
          summaryVisible={page.summaryVisible}
          onApply={page.applyFilters}
          onDraftChange={page.patchDraft}
          onMobileFiltersOpen={() => page.setMobileFilterOpen(true)}
          onRefresh={() => void page.load()}
          onSummaryToggle={() => page.setSummaryVisible((visible) => !visible)}
        />
      </div>

      <SalesListFilterBar
          branchLabel={page.branchLabel}
          branchLoading={page.branchLoading}
          branchOptions={page.branchOptions}
          canApply={page.canApply}
          draftFilters={page.draftFilters}
          loading={page.loading}
          onApply={page.applyFilters}
          onDraftChange={page.patchDraft}
          onRefresh={() => void page.load()}
        />

        <SalesListFilterSheet
          branchLabel={page.branchLabel}
          branchLoading={page.branchLoading}
          branchOptions={page.branchOptions}
          canApply={page.canApply}
          draftFilters={page.draftFilters}
          loading={page.loading}
          open={page.mobileFilterOpen}
          onApply={page.applyMobileFilters}
          onDraftChange={page.patchDraft}
          onOpenChange={page.setMobileFilterOpen}
          onRefresh={() => void page.load()}
        />

        {/* ส่วนที่ไม่ใช่ตารางต้องมีระยะในของตัวเอง เพราะพ่อแม่ไม่มี padding แล้ว */}
        {!page.branchUuid || page.error ? (
          <div className="flex shrink-0 flex-col gap-2 px-2 py-2 sm:px-3">
            {!page.branchUuid ? (
              <SalesListError
                title={t("salesList.branchRequired")}
                description={t("salesList.branchRequiredDescription")}
              />
            ) : null}
            {page.error ? <SalesListError title={t("salesList.loadFailed")} description={page.error} /> : null}
          </div>
        ) : null}

        <div id={SALES_LIST_SUMMARY_CARDS_ID} className="shrink-0 px-2 py-2 sm:px-3" hidden={!page.summaryVisible}>
          <SalesListSummaryCards reportTotal={page.reportTotal} />
        </div>

        {page.initialLoading ? (
          <div className="min-w-0 flex-1 p-3">
            <LoadingState label={t("salesList.loading")} variant="splitPanel" />
          </div>
        ) : (
          // ไม่มี padding และไม่มี gap — สองแผงชนขอบจอและชนกันเอง ใช้เส้น 1px คั่นแทนช่องว่าง
          <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
            <SalesBillListPanel
              bills={page.bills}
              loading={page.loading}
              page={page.page}
              rangeLabel={page.rangeLabel}
              selectedBillId={page.selectedBillId}
              totalAmount={firstNumber(page.reportTotal, ["sum_total"])}
              totalPages={page.safeTotalPages}
              onPageChange={page.goToPage}
              onSelect={page.selectBill}
            />
            <SalesBillDetailPanel
              bill={page.selectedBill}
              cancelSaleHref={page.cancelSaleHref}
              className="hidden xl:flex"
              canReprintReceipt={page.canReprintReceipt}
              loading={page.loading}
              printingBillId={page.printingBillId}
              onReprint={(group) => void page.reprintReceipt(group)}
            />
        </div>
      )}
      <SalesBillDetailDrawer
        bill={page.selectedBill}
        cancelSaleHref={page.cancelSaleHref}
        canReprintReceipt={page.canReprintReceipt}
        loading={page.loading}
        open={page.mobileDetailOpen}
        printingBillId={page.printingBillId}
        onOpenChange={page.setMobileDetailOpen}
        onReprint={(group) => void page.reprintReceipt(group)}
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
