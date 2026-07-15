"use client";

import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { SalesBillDetailDrawer, SalesBillDetailPanel } from "./sales-bill-detail";
import { SalesBillListPanel } from "./sales-bill-list";
import { SalesListFilterSheet, SalesListHeader } from "./sales-list-filters";
import { SalesListSummaryCards } from "./sales-list-summary-cards";
import { firstNumber } from "./sales-list-utils";
import { useSalesListPage } from "./use-sales-list-page";

const SALES_LIST_SUMMARY_CARDS_ID = "sales-list-summary-cards";

export function SalesListPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const page = useSalesListPage(initialPagination);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-muted/20 xl:overflow-hidden">
      <div className="mx-auto flex w-full max-w-375 flex-col gap-2 p-2 sm:gap-3 sm:p-3 lg:p-4 xl:h-full xl:min-h-0">
        <SalesListHeader
          appliedFilters={page.appliedFilters}
          branchLabel={page.branchLabel}
          branchLoading={page.branchLoading}
          branchOptions={page.branchOptions}
          canApply={page.canApply}
          draftFilters={page.draftFilters}
          loading={page.loading}
          searchText={page.searchText}
          summaryControlsId={SALES_LIST_SUMMARY_CARDS_ID}
          summaryVisible={page.summaryVisible}
          onApply={page.applyFilters}
          onDraftChange={page.patchDraft}
          onMobileFiltersOpen={() => page.setMobileFilterOpen(true)}
          onRefresh={() => void page.load()}
          onSearchChange={page.setSearchText}
          onSummaryToggle={() => page.setSummaryVisible((visible) => !visible)}
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

        {!page.branchUuid ? (
          <SalesListError
            title={t("salesList.branchRequired")}
            description={t("salesList.branchRequiredDescription")}
          />
        ) : null}
        {page.error ? <SalesListError title={t("salesList.loadFailed")} description={page.error} /> : null}

        <div id={SALES_LIST_SUMMARY_CARDS_ID} hidden={!page.summaryVisible}>
          <SalesListSummaryCards reportTotal={page.reportTotal} />
        </div>

        {page.initialLoading ? (
          <div className="min-w-0 xl:min-h-0 xl:flex-1">
            <LoadingState label={t("salesList.loading")} variant="splitPanel" />
          </div>
        ) : (
          <div className="grid min-w-0 gap-2 sm:gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
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
              className="hidden xl:flex"
              canReprintReceipt={page.canReprintReceipt}
              loading={page.loading}
              printingBillId={page.printingBillId}
              onReprint={(group) => void page.reprintReceipt(group)}
            />
          </div>
        )}
      </div>
      <SalesBillDetailDrawer
        bill={page.selectedBill}
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
