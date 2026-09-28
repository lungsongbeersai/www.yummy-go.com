"use client";

import { useRef } from "react";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  RefreshCw,
  FileText,
  TriangleAlert,
} from "lucide-react";
import { AppPagination } from "@/components/common/app-pagination";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { StockExportSurface } from "./stock-export-surface";
import { StockFilters, StockLimitSelect, StockStatusTabs } from "./stock-filters";
import { StockMobileList } from "./stock-mobile-list";
import { StockTable } from "./stock-table";
import { useStockPage, type StockPageWorkflow } from "./use-stock-page";

export function StockPage({
  initialPagination,
}: {
  initialPagination: UrlPaginationState;
}) {
  const exportReportRef = useRef<HTMLDivElement>(null);
  const stock = useStockPage(exportReportRef, initialPagination);
  const { t } = stock;
  const initialLoading = stock.loading && !stock.rows.length;

  return (
    // โครงเดียวกับ /products: แท็บสถานะ + ปุ่ม → ตัวกรอง → ตารางในกรอบ → แบ่งหน้า
    // ชื่อหน้าอยู่บนแถบหัวของ app shell แล้ว และสาขาเห็นได้จากช่องเลือกสาขา จึงไม่มีหัวข้อซ้ำในหน้า
    // จอ md ขึ้นไปตารางสกรอลในกรอบของมันเอง — จอเล็กทั้งหน้าสกรอลไปด้วยกัน
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 md:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StockStatusTabs
          disabled={stock.loading || !stock.branchUuid}
          status={stock.status}
          onStatusChange={stock.changeStatus}
        />
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" disabled={stock.exportDisabled}>
                {stock.exporting ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                {t("common.export")}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem disabled={stock.exportDisabled} onSelect={() => void stock.exportExcel()}>
                  <FileSpreadsheet />
                  {t("report.exportExcel")}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={stock.exportDisabled} onSelect={() => void stock.exportPdf()}>
                  <FileText />
                  {t("report.exportPdf")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("actions.refresh")}
            title={t("actions.refresh")}
            disabled={stock.loading || !stock.branchUuid}
            onClick={() => void stock.refresh()}
          >
            {stock.loading ? <Spinner /> : <RefreshCw />}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StockFilters
          branch={stock.branchUuid}
          branchDisabled={stock.loading || stock.branchLoading || !stock.canSelectBranch || !stock.branchUuid}
          branchOptions={stock.branchOptions}
          category={stock.category}
          categoryDisabled={stock.loading || stock.categoryLoading || !stock.branchUuid}
          categoryOptions={stock.categoryOptions}
          onBranchChange={stock.changeBranch}
          onCategoryChange={stock.changeCategory}
        />
      </div>

      {!stock.branchUuid ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t("stock.loadFailed")}</AlertTitle>
          <AlertDescription>{t("stock.branchRequired")}</AlertDescription>
        </Alert>
      ) : (
        <StockResults initialLoading={initialLoading} stock={stock} />
      )}

      {stock.exporting === "pdf" ? (
        <StockExportSurface
          branchLabel={stock.branchName || stock.branchUuid}
          categoryLabel={stock.activeCategoryLabel}
          containerRef={exportReportRef}
          dateLabel={`${t("report.reportDate")}: ${stock.exportDateLabel}`}
          rows={stock.exportRows}
          statusLabel={stock.activeStatusLabel}
          title={t("stock.title")}
        />
      ) : null}
      <BlockingLoadingDialog
        open={Boolean(stock.exporting)}
        title={
          stock.exporting === "excel"
            ? t("report.exportingExcel")
            : t("report.exportingPdf")
        }
        description={t("report.exportingDescription")}
      />
    </div>
  );
}

function StockResults({
  initialLoading,
  stock,
}: {
  initialLoading: boolean;
  stock: StockPageWorkflow;
}) {
  const { t } = stock;

  return (
    <>
      {stock.error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t("stock.loadFailed")}</AlertTitle>
          <AlertDescription>
            <p>{stock.error}</p>
            <Button type="button" variant="outline" disabled={stock.loading} onClick={() => void stock.refresh()}>
              {stock.loading ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
              {t("actions.tryAgain")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {initialLoading ? (
        <LoadingState label={t("stock.loading")} variant="productList" />
      ) : stock.rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-lg border md:flex">
            <StockTable language={stock.language} rows={stock.rows} />
          </div>
          <div className="md:hidden">
            <StockMobileList language={stock.language} rows={stock.rows} />
          </div>
        </>
      ) : stock.error ? null : (
        <EmptyState title={t("stock.noProducts")} description={t("stock.emptyDescription")} />
      )}

      {stock.rows.length ? (
        <div className="flex flex-wrap items-center gap-4 pb-[max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px))]">
          <StockLimitSelect disabled={stock.loading} limit={stock.pageLimit} onLimitChange={stock.changePageLimit} />
          <AppPagination
            className="flex-1"
            disabled={stock.loading}
            page={stock.page}
            rangeLabel={t("common.showingRange", {
              start: stock.pageStart,
              end: stock.pageEnd,
              total: stock.total,
            })}
            totalPages={stock.totalPages}
            onPageChange={stock.goToPage}
          />
        </div>
      ) : null}
    </>
  );
}
