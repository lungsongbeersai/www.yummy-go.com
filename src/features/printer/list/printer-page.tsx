"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Info,
  LayoutGrid,
  Plus,
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
  isOwnedPrinter,
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
import { Spinner } from "@/components/ui/spinner";
import { PrinterSelfTestDialog } from "@/features/printer/printer-self-test-dialog";

const AGENT_DOT: Record<string, string> = {
  connected: "bg-success",
  offline: "bg-warning",
  unauthorized: "bg-warning",
  unchecked: "bg-muted-foreground",
};

const TOGGLE_ITEM_CLASS =
  "h-8 flex-1 rounded-md px-3 text-xs font-semibold whitespace-nowrap data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm sm:flex-none";

export function PrinterPage() {
  const printer = usePrinterPage();
  const { t } = printer;
  // เครื่องพิมพ์ต่อร้านมีไม่กี่เครื่อง — การ์ดเห็นที่อยู่/หน้าที่/ปุ่มทดสอบครบโดยไม่ต้องเลื่อนตารางแนวนอน จึงเป็นค่าเริ่มต้น
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");

  const listViewProps = {
    categories: printer.categories,
    zones: printer.zones,
    networkVisibilityByPrinter: printer.networkVisibilityByPrinter,
    manualTestPrinterUuids: printer.manualTestPrinterUuids,
    filteredRows: printer.filteredRows,
    language: printer.language,
    printing: printer.printing || Boolean(printer.pendingSelfTest),
    selfTestTargets: printer.selfTestTargets,
    roleItemsByPrinter: printer.roleItemsByPrinter,
    statusLabels: printer.statusLabels,
    testingUuid: printer.testingUuid,
    testingDrawerUuid: printer.testingDrawerUuid,
    testingSelfTestUuid: printer.testingSelfTestUuid,
    togglingUuid: printer.togglingUuid,
    userUuid: printer.user?.uuid,
    onDelete: printer.setDeleteTarget,
    onTest: printer.testPrinter,
    onTestDrawer: printer.testDrawer,
    onSelfTest: printer.testSelfTest,
    onToggle: printer.togglePrinter,
  };

  const statusFilters: Array<{ count: number; label: string; value: PrinterStatusFilter; warn?: boolean }> = [
    { value: STATUS_ALL, label: t("printer.summaryAll"), count: printer.summary.total },
    { value: STATUS_ACTIVE, label: printer.statusLabels.active, count: printer.summary.active },
    { value: STATUS_INACTIVE, label: printer.statusLabels.inactive, count: printer.summary.inactive },
    { value: STATUS_ATTENTION, label: t("printer.summaryAttention"), count: printer.summary.attention, warn: true },
  ];
  const filtersActive =
    printer.searchText.trim() !== "" ||
    printer.ownerFilter !== OWNER_ALL ||
    printer.typeFilter !== TYPE_ALL ||
    printer.statusFilter !== STATUS_ALL;

  return (
    // เต็มหน้าจอแบบ sales-list: หัวหน้า → ไทล์สถานะ → แถบค้นหา → รายการ ที่เลื่อนเฉพาะส่วนรายการ
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2.5 sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="text-lg font-semibold">{t("printer.subtitle")}</h1>
          <p className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={printer.agentStatusLabel}>
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", AGENT_DOT[printer.agentStatus] ?? AGENT_DOT.unchecked)} />
            <span className="truncate">Agent: {printer.agentStatusLabel}</span>
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
          {printer.error ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>{t("printer.loadFailed")}</AlertTitle>
              <AlertDescription className="col-start-2">{printer.error}</AlertDescription>
              <Button type="button" variant="outline" className="col-start-2 mt-2 min-h-10" disabled={printer.loading} onClick={() => void printer.load()}>
                {t("actions.tryAgain")}
              </Button>
            </Alert>
          ) : printer.checkingNetwork ? (
            <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />{t("printer.listVisibility.checking")}
            </p>
          ) : printer.listScope === "here" && printer.hiddenLanCount > 0 ? (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" title={t("printer.listVisibility.hiddenDescription")}>
              <Info aria-hidden="true" className="size-3.5 shrink-0" />
              {t("printer.listVisibility.hidden", { count: printer.hiddenLanCount })}
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => printer.setListScope("saved")}>
                {t("printer.listVisibility.showSaved")}
              </Button>
            </p>
          ) : null}
          {/* Agent ไม่เชื่อมต่อ = ทดสอบพิมพ์/เครื่อง USB ใช้ไม่ได้ทั้งหน้า — บอกไว้บนสุดพร้อมทางแก้ แทนให้ไปเจอปุ่มที่กดไม่ได้เอง */}
          {printer.agentStatus === "offline" ? (
            <Alert className="border-warning/40 bg-warning/10 pr-28">
              <AlertTriangle className="text-warning-text" />
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

          {printer.storageWarning ? (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="size-4" />
              <AlertTitle>{t("printer.diagnostics.storageTitle")}</AlertTitle>
              <AlertDescription className="text-foreground">{t(`printer.diagnostics.storage.${printer.storageWarning}`)}</AlertDescription>
            </Alert>
          ) : null}
          {printer.diagnosticWarnings.length ? (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="size-4" />
              <AlertTitle>{t("printer.diagnostics.title")}</AlertTitle>
              <AlertDescription className="min-w-0 text-foreground">
                <ul className="flex flex-col gap-1 break-words">
                  {printer.diagnosticWarnings.map((diagnostic) => (
                    <li key={diagnostic.print_config_uuid}>
                      <span className="font-semibold">{diagnostic.printer_name}: </span>{diagnostic.message}
                      {(diagnostic.status.queued_job_count ?? 0) > 0 ? (
                        <span> {t("printer.diagnostics.pendingJobs", { count: diagnostic.status.queued_job_count })}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p>{t("printer.diagnostics.queueOnly")}</p>
              </AlertDescription>
            </Alert>
          ) : null}

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
                aria-label={t("printer.listVisibility.title")}
                value={printer.listScope}
                onValueChange={(value) => {
                  if (value === "here" || value === "saved") printer.setListScope(value);
                }}
                className="w-full gap-1 rounded-lg border border-border bg-muted p-1 sm:w-auto"
              >
                <ToggleGroupItem value="here" className={TOGGLE_ITEM_CLASS}>{t("printer.listVisibility.here")}</ToggleGroupItem>
                <ToggleGroupItem value="saved" className={TOGGLE_ITEM_CLASS}>{t("printer.listVisibility.saved")}</ToggleGroupItem>
              </ToggleGroup>

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
                {printer.printers.some((row) => row.connect_type === "sunmi") ? (
                  <ToggleGroupItem value="sunmi" className={TOGGLE_ITEM_CLASS}>
                    {t("printer.sunmiPrinter")}
                  </ToggleGroupItem>
                ) : null}
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label={t("common.status")} className="flex flex-wrap items-center gap-1">
              {statusFilters.map((item) => {
                const active = printer.statusFilter === item.value;
                return (
                  <Button
                    key={item.value}
                    type="button"
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                    aria-pressed={active}
                    className={cn("h-8 gap-1.5 px-2.5 text-xs", item.warn && item.count > 0 && "text-warning-text")}
                    onClick={() => printer.setStatusFilter(active && item.value !== STATUS_ALL ? STATUS_ALL : item.value)}
                  >
                    {item.warn && item.count > 0 ? <AlertTriangle data-icon="inline-start" /> : null}
                    {item.label}
                    <span className="font-semibold tabular-nums">{item.count}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {t("common.showingRange", {
                start: printer.pageStart,
                end: printer.pageEnd,
                total: printer.scopeTotal,
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          {(printer.loading && !printer.printers.length) || (printer.checkingNetwork && !printer.filteredRows.length) ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t(printer.checkingNetwork ? "printer.listVisibility.checking" : "printer.loading")} variant="settingsTable" />
            </div>
          ) : printer.filteredRows.length ? (
            viewMode === "table" ? (
              <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border bg-card">
                <PrinterListTable {...listViewProps} />
              </div>
            ) : (
              <PrinterListCards {...listViewProps} />
            )
          ) : !printer.error ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4">
              <EmptyState
                title={t(printer.listScope === "here" && printer.printers.length ? "printer.listVisibility.noneHere" : "printer.noPrinters")}
                description={t(printer.listScope === "here" && printer.printers.length ? "printer.listVisibility.noneHereDescription" : "printer.noPrintersDescription")}
              />
              {/* ตัวกรองเป็นเหตุให้ว่าง ≠ ร้านยังไม่มีเครื่องพิมพ์ — ให้ทางออกที่ตรงกับสาเหตุ */}
              {filtersActive && printer.scopeTotal ? (
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
              ) : printer.listScope === "here" && printer.printers.length ? (
                <Button type="button" variant="outline" onClick={() => printer.setListScope("saved")}>
                  {t("printer.listVisibility.showSaved")}
                </Button>
              ) : (
                <Link className={buttonVariants()} href="/printers/form">
                  <Plus data-icon="inline-start" />
                  {t("printer.add")}
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmVariant="destructive"
        description={t(printer.deleteTarget && !isOwnedPrinter(printer.deleteTarget) ? "printer.deleteSharedConfirm" : "printer.deleteConfirm")}
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
      <PrinterSelfTestDialog
        pendingSelfTest={printer.pendingSelfTest} printing={printer.printing} onReady={printer.completeSelfTest}
        selection={printer.selfTestSelection} profile={printer.selfTestProfile} onProfileChange={printer.setSelfTestProfile}
        onConfirm={printer.confirmSelfTest} onCancel={printer.cancelSelfTest}
        phase={printer.selfTestPhase} error={printer.selfTestError} onCheck={printer.checkSelfTest}
      />
    </div>
  );
}
