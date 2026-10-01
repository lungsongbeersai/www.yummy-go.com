"use client";

import type { ReactNode } from "react";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import {
  BadgePercent,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  HandPlatter,
  Landmark,
  Package,
  Printer,
  ReceiptText,
  Tag,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/format";
import { ReportStatCards, type ReportStat, type ReportStatTone } from "../shared/report-stat-cards";
import type {
  ReportExportAction,
  ReportExportProgress,
  ReportTab,
  SummaryCardConfig,
  SummaryCards,
} from "./daily-sales-report-types";
import { firstNumber, summaryCardValue } from "./daily-sales-report-utils";

interface DailySalesSummaryCardsProps {
  cards: SummaryCardConfig[];
  reportTotal: Record<string, unknown>;
  summaryCards: SummaryCards;
}

interface ReportExportLoadingDialogProps {
  exporting: ReportExportAction | null;
  progress: ReportExportProgress | null;
}

interface DailySalesTableCardProps {
  actions: ReportTableActionsProps;
  children: ReactNode;
  footer: ReactNode;
  loading: boolean;
  rowsLength: number;
}

interface ReportTableActionsProps {
  allDetailGroupsExpanded: boolean;
  billGroupsLength: number;
  columnsMenu: ReactNode;
  summaryCards: ReactNode;
  summaryToggle: ReactNode;
  exportDisabled: boolean;
  exporting: ReportExportAction | null;
  loading: boolean;
  selectedBillCount: number;
  selectedCount: number;
  typePage: ReportTab;
  onClearSelection: () => void;
  onCollapseAllBills: () => void;
  onExpandAllBills: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrintReport: () => void;
  onTypePageChange: (typePage: ReportTab) => void;
}


// ชนิดของตัวเลขต่อการ์ด (ดูความหมายของสีใน report-stat-cards.tsx) — ยอดสุทธิเป็นใบ highlight
const SUMMARY_CARD_PRESENTATION: Record<string, { icon: LucideIcon; tone: ReportStatTone }> = {
  bill_count: { icon: ReceiptText, tone: "info" },
  total_qty: { icon: Package, tone: "info" },
  amount: { icon: Wallet, tone: "success" },
  discount_bill: { icon: BadgePercent, tone: "danger" },
  sum_discount: { icon: Tag, tone: "danger" },
  sum_servicecharge: { icon: HandPlatter, tone: "primary" },
  sum_vate: { icon: Landmark, tone: "warning" },
  sum_total: { icon: TrendingUp, tone: "highlight" },
};

export function DailySalesSummaryCards({
  cards,
  reportTotal,
  summaryCards,
}: DailySalesSummaryCardsProps) {
  const stats: ReportStat[] = cards.map((card) => {
    const value = firstNumber(summaryCardValue(summaryCards, reportTotal, card.keys));
    const presentation = SUMMARY_CARD_PRESENTATION[card.keys[0] ?? ""] ?? { icon: ReceiptText, tone: "primary" };

    return {
      ...presentation,
      key: card.label,
      label: card.label,
      negative: presentation.tone === "danger" && value > 0,
      value: card.kind === "money" ? money(value) : value.toLocaleString("en-US"),
    };
  });

  return <ReportStatCards stats={stats} />;
}

export function ReportExportLoadingDialog({
  exporting,
  progress,
}: ReportExportLoadingDialogProps) {
  const { t } = useTranslation();
  const actionLabel =
    exporting === "excel"
      ? t("report.exportingExcel")
      : exporting === "pdf"
      ? t("report.exportingPdf")
      : t("report.preparingPrint");
  const percent = progress?.percent ?? 0;
  const progressLabel = progress?.label ?? t("report.exportingDescription");

  return (
    <BlockingLoadingDialog
      open={Boolean(exporting)}
      title={actionLabel}
      description={t("report.exportingDescription")}
      progressLabel={progressLabel}
      progressValue={percent}
    />
  );
}

export function DailySalesTableCard({
  actions,
  children,
  footer,
  loading,
  rowsLength,
}: DailySalesTableCardProps) {
  const { t } = useTranslation();

  return (
    <>
      <ReportTableActions {...actions} />
      {actions.summaryCards}

      {loading && !rowsLength ? (
        <div className="min-h-96 flex-1 overflow-hidden lg:min-h-0">
          {/* skeleton เป็น h-full — ต้องครอบให้ได้แค่ความสูงที่เหลือ ไม่งั้นมันขอเต็มหน้าแล้วไปบีบตัวกรองด้านบน */}
          <LoadingState label={t("report.loading")} variant="reportTable" />
        </div>
      ) : rowsLength ? (
        <>
          {/* กรอบตารางแบบ shadcn Data Table — ตารางสกรอลอยู่ในกรอบ, แบ่งหน้าอยู่นอกกรอบด้านล่าง
              จอเล็กทั้งหน้าสกรอล จึงให้กรอบมีความสูงขั้นต่ำไว้ ไม่งั้น flex-1 จะหดจนเหลือศูนย์ */}
          <div aria-busy={loading} className="flex min-h-96 flex-1 flex-col overflow-hidden rounded-lg border lg:min-h-0">
            {children}
          </div>
          {footer}
        </>
      ) : (
        <EmptyState title={t("report.noData")} description={t("report.adjustFilters")} />
      )}
    </>
  );
}

function ReportTableActions({
  allDetailGroupsExpanded,
  billGroupsLength,
  columnsMenu,
  exportDisabled,
  exporting,
  loading,
  selectedBillCount,
  selectedCount,
  summaryToggle,
  typePage,
  onClearSelection,
  onCollapseAllBills,
  onExpandAllBills,
  onExportExcel,
  onExportPdf,
  onPrintReport,
  onTypePageChange,
}: ReportTableActionsProps) {
  const { t } = useTranslation();
  const isDetail = typePage === "detail";
  const selectedDisplayCount = isDetail ? selectedBillCount : selectedCount;
  const disabled = loading || Boolean(exporting);
  const expandLabel = allDetailGroupsExpanded ? t("actions.collapseAll") : t("actions.expandAll");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={typePage}
        onValueChange={(value) => {
          if (value === "bill" || value === "detail") onTypePageChange(value);
        }}
      >
        <TabsList>
          <TabsTrigger value="bill" disabled={disabled}>
            {t("report.salesReportByBill")}
          </TabsTrigger>
          <TabsTrigger value="detail" disabled={disabled}>
            {t("report.detailedSalesReport")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* แสดงเฉพาะตอนมีรายการถูกเลือก — ผลของการเลือกคือ export/พิมพ์เฉพาะรายการนั้น */}
      {selectedDisplayCount > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isDetail
              ? t("report.selectedBillsForPrint", { count: selectedDisplayCount })
              : t("report.selectedForExport", { count: selectedDisplayCount })}
          </span>
          <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onClearSelection}>
            {t("report.clearSelection")}
          </Button>
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {isDetail && billGroupsLength ? (
          <Button type="button" variant="outline" disabled={disabled} title={expandLabel} onClick={allDetailGroupsExpanded ? onCollapseAllBills : onExpandAllBills}>
            {allDetailGroupsExpanded ? <ChevronsDownUp data-icon="inline-start" /> : <ChevronsUpDown data-icon="inline-start" />}
            <span className="hidden sm:inline">{expandLabel}</span>
            <span className="sr-only sm:hidden">{expandLabel}</span>
          </Button>
        ) : null}
        {summaryToggle}
        {columnsMenu}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" aria-label={t("common.export")} disabled={exportDisabled}>
              {exporting ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
              <span className="hidden sm:inline">{t("common.export")}</span>
              <ChevronDown data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={exportDisabled} onSelect={onExportExcel}>
                <FileSpreadsheet />
                {t("report.exportExcel")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportDisabled} onSelect={onExportPdf}>
                <FileText />
                {t("report.exportPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exportDisabled} onSelect={onPrintReport}>
                <Printer />
                {t("report.print")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
