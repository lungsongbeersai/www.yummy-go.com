"use client";

import { useRef } from "react";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  RefreshCw,
  TriangleAlert,
  Warehouse,
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
import { StockFilters } from "./stock-filters";
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Warehouse className="shrink-0 text-primary" aria-hidden="true" />
              <h1 className="truncate text-lg font-black tracking-tight text-foreground">
                {t("stock.title")}
              </h1>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
              {stock.branchUuid
                ? `${t("stock.branchLabel")}: ${stock.branchName || stock.branchUuid}`
                : t("stock.branchRequired")}
              <span className="hidden lg:inline"> · {t("stock.description")}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 lg:h-8"
                  disabled={stock.exportDisabled}
                >
                  {stock.exporting ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Download data-icon="inline-start" />
                  )}
                  {t("common.export")}
                  <ChevronDown data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={stock.exportDisabled}
                    onSelect={() => void stock.exportExcel()}
                  >
                    <FileSpreadsheet data-icon="inline-start" />
                    {t("report.exportExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={stock.exportDisabled}
                    onSelect={() => void stock.exportPdf()}
                  >
                    <Download data-icon="inline-start" />
                    {t("report.exportPdf")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 lg:h-8"
              disabled={stock.loading || !stock.branchUuid}
              onClick={() => void stock.refresh()}
            >
              {stock.loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              {t("actions.refresh")}
            </Button>
          </div>
        </div>

        <div className="border-t border-border bg-muted/15 px-4 py-2.5 lg:px-5">
          <StockFilters
            branch={stock.branchUuid}
            branchDisabled={
              stock.loading ||
              stock.branchLoading ||
              !stock.canSelectBranch ||
              !stock.branchUuid
            }
            branchOptions={stock.branchOptions}
            category={stock.category}
            categoryDisabled={
              stock.loading || stock.categoryLoading || !stock.branchUuid
            }
            categoryOptions={stock.categoryOptions}
            disabled={stock.loading || !stock.branchUuid}
            limit={stock.pageLimit}
            status={stock.status}
            onBranchChange={stock.changeBranch}
            onCategoryChange={stock.changeCategory}
            onLimitChange={stock.changePageLimit}
            onStatusChange={stock.changeStatus}
          />
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!stock.branchUuid ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <Alert className="max-w-xl" variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{t("stock.loadFailed")}</AlertTitle>
              <AlertDescription>{t("stock.branchRequired")}</AlertDescription>
            </Alert>
          </div>
        ) : (
          <StockResults initialLoading={initialLoading} stock={stock} />
        )}
      </section>

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
        <div className="shrink-0 px-4 pt-3 lg:px-5">
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t("stock.loadFailed")}</AlertTitle>
            <AlertDescription>
              <p>{stock.error}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 lg:h-8"
                disabled={stock.loading}
                onClick={() => void stock.refresh()}
              >
                {stock.loading ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                {t("actions.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {initialLoading ? (
          <div className="h-full p-4">
            <LoadingState label={t("stock.loading")} variant="productList" />
          </div>
        ) : stock.rows.length ? (
          <>
            <StockTable language={stock.language} rows={stock.rows} />
            <StockMobileList language={stock.language} rows={stock.rows} />
          </>
        ) : stock.error ? null : (
          <div className="flex h-full min-h-72 items-center justify-center p-4">
            <EmptyState
              title={t("stock.noProducts")}
              description={t("stock.emptyDescription")}
            />
          </div>
        )}
      </div>

      {stock.rows.length ? (
        <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between lg:px-5">
          <AppPagination
            compact
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
        </footer>
      ) : null}
    </>
  );
}
