"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Download,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { SearchInput } from "@/components/common/search-input";
import { LoadingState } from "@/components/common/loading-state";
import { cn } from "@/lib/utils";
import { AgentPlatformIcon, PrinterDownloadsMenu } from "./printer-downloads-menu";
import { PrinterListCards } from "./printer-list-cards";
import { PrinterListTable } from "./printer-list-table";
import {
  agentDownloadUrl,
  PRINTER_SETUP_DOWNLOAD_URL,
  STATUS_ALL,
  TYPE_ALL,
  XPRINTER_DRIVER_FILE_NAME,
  XPRINTER_DRIVER_URL,
} from "./printer-page-utils";
import { usePrinterPage } from "./use-printer-page";

export function PrinterPage() {
  const printer = usePrinterPage();
  const { t } = printer;

  const listViewProps = {
    categories: printer.categories,
    filteredRows: printer.filteredRows,
    language: printer.language,
    printing: printer.printing,
    roleItemsByPrinter: printer.roleItemsByPrinter,
    statusLabels: printer.statusLabels,
    testingUuid: printer.testingUuid,
    togglingUuid: printer.togglingUuid,
    userUuid: printer.user?.uuid,
    onDelete: printer.setDeleteTarget,
    onTest: printer.testPrinter,
    onToggle: printer.togglePrinter,
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 lg:px-5 lg:py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-primary">
              {t("printer.subtitle")}
            </p>
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              {t("printer.agentStatus")}: {printer.agentStatusLabel}
            </p>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 md:hidden"
            title={`${t("printer.agentStatus")}: ${printer.agentStatusLabel}`}
          >
            {printer.agentStatusLabel}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="lg:hidden">
            <PrinterDownloadsMenu
              activeAgentFiles={printer.activeAgentFiles}
              agentFilesFailed={printer.agentFilesFailed}
              loadingAgentFiles={printer.loadingAgentFiles}
              onAgentOpenChange={printer.loadAgentFilesOnOpen}
              onDriverDownload={printer.showDriverDownloadToast}
              onLaoFontDownload={printer.showLaoFontDownloadToast}
              onPrinterSetupDownload={printer.showPrinterSetupDownloadToast}
            />
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Button
              asChild
              className="shadow-sm"
              size="sm"
              type="button"
              variant="outline"
            >
              <a
                href={XPRINTER_DRIVER_URL}
                download={XPRINTER_DRIVER_FILE_NAME}
                onClick={printer.showDriverDownloadToast}
              >
                <Download data-icon="inline-start" />
                {t("printer.installDriver")}
              </a>
            </Button>

            <DropdownMenu onOpenChange={printer.loadAgentFilesOnOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  className="shadow-sm"
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {printer.loadingAgentFiles ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Download data-icon="inline-start" />
                  )}
                  {t("printer.downloadAgent")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuGroup>
                  {printer.loadingAgentFiles ? (
                    <DropdownMenuItem disabled>
                      <Spinner />
                      {t("printer.loadingAgentFiles")}
                    </DropdownMenuItem>
                  ) : printer.agentFilesFailed ? (
                    <DropdownMenuItem disabled>
                      {t("printer.agentFilesLoadFailed")}
                    </DropdownMenuItem>
                  ) : printer.activeAgentFiles.length ? (
                    printer.activeAgentFiles.map((file) => {
                      const platformKey = file.file_platform
                        .trim()
                        .toLowerCase();
                      const platformLabel = t(
                        `printer.agentPlatform.${platformKey}`,
                        {
                          defaultValue:
                            file.file_platform || t("printer.agent"),
                        },
                      );
                      const url = agentDownloadUrl(file);

                      return (
                        <DropdownMenuItem key={file.agent_file_uuid} asChild>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            download={file.file_name}
                          >
                            <AgentPlatformIcon platform={file.file_platform} />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-semibold">
                                {platformLabel}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {file.file_name}
                              </span>
                            </span>
                          </a>
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled>
                      {t("printer.noAgentFiles")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button asChild className="shadow-sm" size="sm" variant="outline">
              <a
                href="/downloads/laoscript8.msi"
                download
                onClick={printer.showLaoFontDownloadToast}
              >
                <Download data-icon="inline-start" />
                {t("printer.downloadLaoFont")}
              </a>
            </Button>

            <Button asChild className="shadow-sm" size="sm" variant="outline">
              <a
                href={PRINTER_SETUP_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                onClick={printer.showPrinterSetupDownloadToast}
              >
                <Download data-icon="inline-start" />
                {t("printer.downloadPrinterSetup")}
              </a>
            </Button>
          </div>

          <Link
            className={cn(buttonVariants({ size: "sm" }), "shadow-sm")}
            href="/printers/form"
          >
            <Plus data-icon="inline-start" />
            <span className="hidden sm:inline">
              {t("actions.add")} {t("printer.title")}
            </span>
            <span className="sm:hidden">{t("actions.add")}</span>
          </Link>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        <div className="shrink-0 border-t border-border bg-muted/10 px-3 py-2 sm:px-4 lg:px-5">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-muted-foreground sm:text-sm">
              {t("common.showingRange", {
                start: printer.pageStart,
                end: printer.pageEnd,
                total: printer.printers.length,
              })}
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-2 md:grid-cols-[minmax(0,1fr)_2.25rem_10rem_10rem] lg:grid-cols-[minmax(0,1fr)_2.25rem_10rem_10rem]">
            <Field className="gap-1 md:col-span-1">
              <FieldLabel htmlFor="printer-search-filter" className="sr-only">
                {t("actions.search")}
              </FieldLabel>
              <SearchInput
                id="printer-search-filter"
                className="min-w-0"
                inputClassName="text-sm"
                value={printer.searchText}
                placeholder={t("settings.searchPlaceholder")}
                onChange={printer.setSearchText}
              />
            </Field>

            <Button
              className="h-9 w-9 shrink-0"
              size="iconSm"
              variant="outline"
              aria-label={t("actions.refresh")}
              onClick={printer.load}
            >
              <RefreshCcw />
            </Button>

            <Select value={printer.typeFilter} onValueChange={printer.setTypeFilter}>
              <Field className="col-span-2 gap-1 md:col-span-1">
                <FieldLabel htmlFor="printer-type-filter" className="sr-only">
                  {t("fields.connectType")}
                </FieldLabel>
                <SelectTrigger
                  id="printer-type-filter"
                  className="h-9 w-full bg-background font-semibold"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value={TYPE_ALL}>
                      {t("printer.allTypes")}
                    </SelectItem>
                    <SelectItem value="tcp">
                      {t("printer.tcpPrinter")}
                    </SelectItem>
                    <SelectItem value="usb">
                      {t("printer.usbPrinter")}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Field>
            </Select>

            <Select value={printer.statusFilter} onValueChange={printer.setStatusFilter}>
              <Field className="col-span-2 gap-1 md:col-span-1">
                <FieldLabel htmlFor="printer-status-filter" className="sr-only">
                  {t("common.status")}
                </FieldLabel>
                <SelectTrigger
                  id="printer-status-filter"
                  className="h-9 w-full bg-background font-semibold"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value={STATUS_ALL}>
                      {t("printer.allStatuses")}
                    </SelectItem>
                    <SelectItem value="active">
                      {printer.statusLabels.active}
                    </SelectItem>
                    <SelectItem value="inactive">
                      {printer.statusLabels.inactive}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Field>
            </Select>
          </div>

          <Alert className="mt-2 hidden items-center gap-2 border-primary/20 bg-primary/5 xl:flex">
            <AlertTriangle className="text-primary " />
            <AlertTitle className="font-black">
              {t("printer.laoFontNoticeTitle")}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">
                {t("printer.laoFontNoticeDescription")}
              </span>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="shrink-0 bg-background"
              >
                <a
                  href="/downloads/laoscript8.msi"
                  download
                  onClick={printer.showLaoFontDownloadToast}
                >
                  <Download data-icon="inline-start" />
                  {t("printer.downloadLaoFont")}
                </a>
              </Button>
            </AlertDescription>
          </Alert>
        </div>

        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {printer.loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("printer.loading")} variant="settingsTable" />
            </div>
          ) : printer.filteredRows.length ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <PrinterListTable {...listViewProps} />
              <PrinterListCards {...listViewProps} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-4">
              <EmptyState
                title={t("printer.noPrinters")}
                description={t("printer.noPrintersDescription")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        description={t("printer.deleteConfirm")}
        open={Boolean(printer.deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (printer.deleteTarget) void printer.remove(printer.deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) printer.setDeleteTarget(null);
        }}
      />
    </div>
  );
}
