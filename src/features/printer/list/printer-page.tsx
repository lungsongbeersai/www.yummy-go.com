"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  LayoutGrid,
  Plus,
  Power,
  PowerOff,
  Printer as PrinterIcon,
  RefreshCcw,
  Table2,
} from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PrintLoadingDialog } from "@/components/common/print-loading-dialog";
import { SearchInput } from "@/components/common/search-input";
import { LoadingState } from "@/components/common/loading-state";
import { cn } from "@/lib/utils";
import { PrinterDownloadsMenu } from "./printer-downloads-menu";
import { PrinterListCards } from "./printer-list-cards";
import { PrinterListTable } from "./printer-list-table";
import {
  OWNER_ALL,
  OWNER_MINE,
  OWNER_SHARED,
  STATUS_ACTIVE,
  STATUS_ALL,
  STATUS_ATTENTION,
  STATUS_INACTIVE,
  TYPE_ALL,
  type PrinterStatusFilter,
} from "./printer-page-utils";
import { usePrinterPage } from "./use-printer-page";

const AGENT_DOT: Record<string, string> = {
  connected: "bg-success",
  offline: "bg-warning",
  unchecked: "bg-muted-foreground",
};

const TOGGLE_ITEM_CLASS =
  "h-8 flex-1 rounded-md px-3 text-xs font-semibold whitespace-nowrap data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:flex-none";

export function PrinterPage() {
  const printer = usePrinterPage();
  const { t } = printer;
  // เครื่องพิมพ์ต่อร้านมีไม่กี่เครื่อง — การ์ดเห็นที่อยู่/หน้าที่/ปุ่มทดสอบครบโดยไม่ต้องเลื่อนตารางแนวนอน จึงเป็นค่าเริ่มต้น
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");

  const listViewProps = {
    categories: printer.categories,
    zones: printer.zones,
    filteredRows: printer.filteredRows,
    language: printer.language,
    printing: printer.printing,
    roleItemsByPrinter: printer.roleItemsByPrinter,
    statusLabels: printer.statusLabels,
    testingUuid: printer.testingUuid,
    testingDrawerUuid: printer.testingDrawerUuid,
    togglingUuid: printer.togglingUuid,
    userUuid: printer.user?.uuid,
    onDelete: printer.setDeleteTarget,
    onTest: printer.testPrinter,
    onTestDrawer: printer.testDrawer,
    onToggle: printer.togglePrinter,
  };

  const statusTiles: Array<{
    count: number;
    icon: ComponentType<{ className?: string }>;
    label: string;
    tone?: "warning";
    value: PrinterStatusFilter;
  }> = [
    { value: STATUS_ALL, label: t("printer.summaryAll"), count: printer.summary.total, icon: PrinterIcon },
    { value: STATUS_ACTIVE, label: printer.statusLabels.active, count: printer.summary.active, icon: Power },
    { value: STATUS_INACTIVE, label: printer.statusLabels.inactive, count: printer.summary.inactive, icon: PowerOff },
    {
      value: STATUS_ATTENTION,
      label: t("printer.summaryAttention"),
      count: printer.summary.attention,
      icon: AlertTriangle,
      tone: "warning",
    },
  ];
  const filtersActive =
    printer.searchText.trim() !== "" ||
    printer.ownerFilter !== OWNER_ALL ||
    printer.typeFilter !== TYPE_ALL ||
    printer.statusFilter !== STATUS_ALL;

  return (
    // เต็มหน้าจอแบบ sales-list: หัวหน้า → ไทล์สถานะ → แถบค้นหา → รายการ ที่เลื่อนเฉพาะส่วนรายการ
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:px-4 lg:px-5">
        <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:grid">
          <PrinterIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-black leading-6 text-foreground">{t("printer.subtitle")}</h1>
          {/* สถานะ Agent เป็นจุดสี + ข้อความ — เดิมเป็นข้อความเทาเล็ก ๆ ท้ายชื่อหน้า มองไม่ออกว่าเชื่อมต่ออยู่หรือไม่ */}
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={printer.agentStatusLabel}>
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", AGENT_DOT[printer.agentStatus] ?? AGENT_DOT.unchecked)} />
            <span className="shrink-0">{t("printer.agentStatus")}:</span>
            <span className="truncate font-semibold text-foreground">{printer.agentStatusLabel}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PrinterDownloadsMenu
            activeAgentFiles={printer.activeAgentFiles}
            agentFilesFailed={printer.agentFilesFailed}
            loadingAgentFiles={printer.loadingAgentFiles}
            triggerClassName="h-10 sm:h-9"
            onAgentOpenChange={printer.loadAgentFilesOnOpen}
            onDriverDownload={printer.showDriverDownloadToast}
            onLaoFontDownload={printer.showLaoFontDownloadToast}
            onPrinterSetupDownload={printer.showPrinterSetupDownloadToast}
          />
          <Link className={cn(buttonVariants(), "h-10 sm:h-9")} href="/printers/form">
            <Plus data-icon="inline-start" />
            <span className="hidden sm:inline">{t("printer.add")}</span>
            <span className="sm:hidden">{t("actions.add")}</span>
          </Link>
        </div>
      </header>

      {/* จอเล็กกว่า lg: ไทล์ + แถบค้นหาเลื่อนไปพร้อมรายการทั้งก้อน — ถ้าปักไว้แล้วให้เลื่อนแค่รายการ
          บนมือถือจะเหลือพื้นที่ให้การ์ดไม่ถึงครึ่งจอ จอ lg ขึ้นไปค่อยปักส่วนบนแล้วเลื่อนเฉพาะรายการ */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:flex lg:flex-col lg:overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 px-3 pt-3 sm:px-4 lg:px-5">
          {/* Agent ไม่เชื่อมต่อ = ทดสอบพิมพ์/เครื่อง USB ใช้ไม่ได้ทั้งหน้า — บอกไว้บนสุดพร้อมทางแก้ แทนให้ไปเจอปุ่มที่กดไม่ได้เอง */}
          {printer.agentStatus === "offline" ? (
            <Alert className="border-warning/30 bg-warning/5 pr-28">
              <AlertTriangle className="text-warning" />
              <AlertTitle>{t("printer.agentOfflineTitle")}</AlertTitle>
              <AlertDescription>{t("printer.agentOfflineDescription")}</AlertDescription>
              <AlertAction>
                <Button type="button" size="sm" variant="outline" className="h-8 bg-background" disabled={printer.loading} onClick={() => void printer.load()}>
                  <RefreshCcw className={printer.loading ? "animate-spin" : undefined} data-icon="inline-start" />
                  {t("actions.refresh")}
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          {/* ไทล์สถานะ = ตัวกรองสถานะ (แทน dropdown เดิม) เห็นตัวเลขของทุกสถานะพร้อมกัน กดครั้งเดียวกรองได้เลย */}
          <div role="group" aria-label={t("common.status")} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {statusTiles.map((tile) => {
              const Icon = tile.icon;
              const active = printer.statusFilter === tile.value;
              const warn = tile.tone === "warning" && tile.count > 0;
              return (
                <button
                  key={tile.value}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/30 hover:bg-primary/5",
                  )}
                  onClick={() => printer.setStatusFilter(active && tile.value !== STATUS_ALL ? STATUS_ALL : tile.value)}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      warn ? "bg-warning/15 text-warning" : active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-semibold text-muted-foreground">{tile.label}</span>
                    <span className={cn("text-xl leading-6 font-black tabular-nums", warn ? "text-warning" : "text-foreground")}>
                      {tile.count}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <Card className="gap-0 rounded-xl py-0 shadow-xs">
            <CardContent className="flex flex-wrap items-center gap-2 p-2.5">
              <Field className="min-w-48 flex-1 gap-1">
                <FieldLabel htmlFor="printer-search-filter" className="sr-only">
                  {t("actions.search")}
                </FieldLabel>
                <SearchInput
                  id="printer-search-filter"
                  className="min-w-0"
                  inputClassName="h-9 text-sm"
                  value={printer.searchText}
                  placeholder={t("settings.searchPlaceholder")}
                  onChange={printer.setSearchText}
                />
              </Field>

              <ToggleGroup
                type="single"
                aria-label={t("printer.filterOwnership")}
                value={printer.ownerFilter}
                onValueChange={(value) => {
                  if (value === OWNER_ALL || value === OWNER_MINE || value === OWNER_SHARED) printer.setOwnerFilter(value);
                }}
                className="w-full gap-1 rounded-lg border border-border bg-muted p-1 sm:w-auto"
              >
                <ToggleGroupItem value={OWNER_ALL} className={TOGGLE_ITEM_CLASS}>
                  {t("printer.allOwnership")}
                </ToggleGroupItem>
                <ToggleGroupItem value={OWNER_MINE} className={TOGGLE_ITEM_CLASS}>
                  {t("printer.myPrinters")}
                </ToggleGroupItem>
                <ToggleGroupItem value={OWNER_SHARED} className={TOGGLE_ITEM_CLASS}>
                  {t("printer.sharedPrinters")}
                </ToggleGroupItem>
              </ToggleGroup>

              <ToggleGroup
                type="single"
                aria-label={t("printer.filterConnection")}
                value={printer.typeFilter}
                onValueChange={(value) => {
                  if (value) printer.setTypeFilter(value);
                }}
                className="w-full gap-1 rounded-lg border border-border bg-muted p-1 sm:w-auto"
              >
                <ToggleGroupItem value={TYPE_ALL} className={TOGGLE_ITEM_CLASS}>
                  {t("printer.allTypes")}
                </ToggleGroupItem>
                <ToggleGroupItem value="tcp" className={TOGGLE_ITEM_CLASS}>
                  {t("printer.tcpPrinter")}
                </ToggleGroupItem>
                <ToggleGroupItem value="usb" className={TOGGLE_ITEM_CLASS}>
                  {t("printer.usbPrinter")}
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={viewMode}
                  aria-label={t("printer.viewMode")}
                  onValueChange={(value) => {
                    if (value === "table" || value === "cards") setViewMode(value);
                  }}
                >
                  <ToggleGroupItem value="cards" aria-label={t("printer.cardView")} className="size-9">
                    <LayoutGrid />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="table" aria-label={t("printer.tableView")} className="size-9">
                    <Table2 />
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  type="button"
                  className="size-9 shrink-0"
                  size="icon"
                  variant="outline"
                  aria-label={t("actions.refresh")}
                  title={t("actions.refresh")}
                  disabled={printer.loading}
                  onClick={() => void printer.load()}
                >
                  <RefreshCcw className={printer.loading ? "animate-spin" : undefined} />
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="truncate text-xs font-medium text-muted-foreground" aria-live="polite">
            {t("common.showingRange", {
              start: printer.pageStart,
              end: printer.pageEnd,
              total: printer.printers.length,
            })}
          </p>
        </div>

        <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          {printer.loading && !printer.printers.length ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("printer.loading")} variant="settingsTable" />
            </div>
          ) : printer.filteredRows.length ? (
            viewMode === "table" ? (
              <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-card">
                <PrinterListTable {...listViewProps} />
              </div>
            ) : (
              <PrinterListCards {...listViewProps} />
            )
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4">
              <EmptyState title={t("printer.noPrinters")} description={t("printer.noPrintersDescription")} />
              {/* ตัวกรองเป็นเหตุให้ว่าง ≠ ร้านยังไม่มีเครื่องพิมพ์ — ให้ทางออกที่ตรงกับสาเหตุ */}
              {filtersActive && printer.printers.length ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    printer.setSearchText("");
                    printer.setOwnerFilter(OWNER_ALL);
                    printer.setTypeFilter(TYPE_ALL);
                    printer.setStatusFilter(STATUS_ALL);
                  }}
                >
                  {t("actions.clear")}
                </Button>
              ) : (
                <Link className={buttonVariants()} href="/printers/form">
                  <Plus data-icon="inline-start" />
                  {t("printer.add")}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmVariant="destructive"
        description={t("printer.deleteConfirm")}
        open={Boolean(printer.deleteTarget)}
        title={printer.deleteTarget ? `${t("actions.delete")} · ${printer.deleteTarget.printer_name}` : t("actions.delete")}
        onConfirm={() => {
          if (printer.deleteTarget) void printer.remove(printer.deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) printer.setDeleteTarget(null);
        }}
      />
      <PrintLoadingDialog open={Boolean(printer.testingUuid)} />
    </div>
  );
}
