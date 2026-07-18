"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Apple,
  Download,
  MonitorDown,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import type { Category } from "@/services/category";
import type { Printer } from "@/services/printer";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { PrinterListCards } from "./printer-list-cards";
import { PrinterListTable } from "./printer-list-table";
import {
  agentDownloadUrl,
  categoryLabel,
  PRINTER_SETUP_DOWNLOAD_URL,
  printerCategories,
  roleLabel,
  STATUS_ALL,
  TYPE_ALL,
  XPRINTER_DRIVER_FILE_NAME,
  XPRINTER_DRIVER_URL,
} from "./printer-page-utils";

const EMPTY_CATEGORIES: Category[] = [];

function AgentPlatformIcon({ platform }: { platform: string }) {
  const normalizedPlatform = platform.trim().toLowerCase();

  if (normalizedPlatform.includes("mac")) return <Apple aria-hidden="true" />;
  if (normalizedPlatform.includes("win"))
    return <MonitorDown aria-hidden="true" />;

  return <Download aria-hidden="true" />;
}

function PrinterDownloadsMenu({
  activeAgentFiles,
  agentFilesFailed,
  loadingAgentFiles,
  onAgentOpenChange,
  onDriverDownload,
  onLaoFontDownload,
  onPrinterSetupDownload,
}: {
  activeAgentFiles: Array<{
    agent_file_uuid: string;
    download_url?: string;
    file_name: string;
    file_platform: string;
  }>;
  agentFilesFailed: boolean;
  loadingAgentFiles: boolean;
  onAgentOpenChange: (open: boolean) => void;
  onDriverDownload: () => void;
  onLaoFontDownload: () => void;
  onPrinterSetupDownload: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu onOpenChange={onAgentOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          className="shadow-sm"
          size="sm"
          type="button"
          variant="outline"
          aria-label={t("printer.downloadsMenu")}
        >
          <Download data-icon="inline-start" />
          <span className="hidden sm:inline">{t("printer.downloadsMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("printer.downloadsMenu")}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a
              href={XPRINTER_DRIVER_URL}
              download={XPRINTER_DRIVER_FILE_NAME}
              onClick={onDriverDownload}
            >
              <Download />
              {t("printer.installDriver")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href="/downloads/laoscript8.msi"
              download
              onClick={onLaoFontDownload}
            >
              <Download />
              {t("printer.downloadLaoFont")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={PRINTER_SETUP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              onClick={onPrinterSetupDownload}
            >
              <Download />
              {t("printer.downloadPrinterSetup")}
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("printer.downloadAgent")}</DropdownMenuLabel>
          {loadingAgentFiles ? (
            <DropdownMenuItem disabled>
              <Spinner />
              {t("printer.loadingAgentFiles")}
            </DropdownMenuItem>
          ) : agentFilesFailed ? (
            <DropdownMenuItem disabled>
              {t("printer.agentFilesLoadFailed")}
            </DropdownMenuItem>
          ) : activeAgentFiles.length ? (
            activeAgentFiles.map((file) => {
              const platformKey = file.file_platform.trim().toLowerCase();
              const platformLabel = t(`printer.agentPlatform.${platformKey}`, {
                defaultValue: file.file_platform || t("printer.agent"),
              });
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
  );
}

export function PrinterPage() {
  const { i18n, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const printers = usePrinterStore((state) => state.printers);
  const roles = usePrinterStore((state) => state.roles);
  const agentStatus = usePrinterStore((state) => state.agentStatus);
  const agentError = usePrinterStore((state) => state.agentError);
  const agentFiles = usePrinterStore((state) => state.agentFiles);
  const loading = usePrinterStore((state) => state.loading);
  const loadingAgentFiles = usePrinterStore((state) => state.loadingAgentFiles);
  const printing = usePrinterStore((state) => state.printing);
  const loadPrintersForLocalAgent = usePrinterStore(
    (state) => state.loadPrintersForLocalAgent,
  );
  const loadAgentFiles = usePrinterStore((state) => state.loadAgentFiles);
  const loadRoles = usePrinterStore((state) => state.loadRoles);
  const testPrinterAction = usePrinterStore((state) => state.test);
  const toggleActive = usePrinterStore((state) => state.toggleActive);
  const removePrinter = usePrinterStore((state) => state.remove);
  const categories = (useReferenceStore((state) => state.options.categories) ??
    EMPTY_CATEGORIES) as Category[];
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const [deleteTarget, setDeleteTarget] = useState<Printer | null>(null);
  const [testingUuid, setTestingUuid] = useState("");
  const [togglingUuid, setTogglingUuid] = useState("");
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [agentFilesFailed, setAgentFilesFailed] = useState(false);

  const language = i18n.language;
  const storeUuid = authStoreUuid(user);
  const roleItemsByPrinter = useMemo(
    () =>
      new Map(
        printers.map((printer) => [
          printer.print_config_uuid,
          printer.role_codes.map((code) => ({
            label: roleLabel(code, roles),
            value: code,
          })),
        ]),
      ),
    [printers, roles],
  );
  const statusLabels = useMemo(
    () => ({
      active: t("printer.enabledStatus"),
      inactive: t("printer.disabledStatus"),
    }),
    [t],
  );
  const activeAgentFiles = useMemo(
    () =>
      agentFiles.filter(
        (file) => Number(file.file_status) === 1 && agentDownloadUrl(file),
      ),
    [agentFiles],
  );
  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return printers
      .filter((printer) => {
        const matchesType =
          typeFilter === TYPE_ALL || printer.connect_type === typeFilter;
        const matchesStatus =
          statusFilter === STATUS_ALL ||
          (statusFilter === "active" ? printer.is_active : !printer.is_active);
        const roleText = printer.role_codes
          .map((code) => roleLabel(code, roles))
          .join(" ");
        const categoryText = printerCategories(printer, categories)
          .map((category) => categoryLabel(category, language))
          .join(" ");
        const searchable = [
          printer.printer_name,
          printer.connect_type,
          printer.interface_value,
          printer.device_code,
          printer.agent_name,
          roleText,
          categoryText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          matchesType && matchesStatus && (!query || searchable.includes(query))
        );
      })
      .map((printer, index) => ({ ...printer, row_number: index + 1 }));
  }, [
    categories,
    language,
    printers,
    roles,
    searchText,
    statusFilter,
    typeFilter,
  ]);
  const pageStart = filteredRows.length ? 1 : 0;
  const pageEnd = filteredRows.length;
  const agentStatusLabel = agentError ?? t(`printer.status.${agentStatus}`);

  const load = useCallback(async () => {
    if (!user?.uuid) return;
    try {
      await Promise.all([
        loadPrintersForLocalAgent({ login_uuid_fk: user.uuid, lang: language }),
        loadRoles(language),
        storeUuid ? loadCategories(language, storeUuid) : Promise.resolve([]),
      ]);
    } catch (error) {
      showToast({
        title: t("printer.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [
    language,
    loadCategories,
    loadPrintersForLocalAgent,
    loadRoles,
    showToast,
    storeUuid,
    t,
    user?.uuid,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAgentFilesOnOpen = useCallback(
    (open: boolean) => {
      if (!open || agentFiles.length || loadingAgentFiles) return;
      setAgentFilesFailed(false);
      void loadAgentFiles().catch((error) => {
        setAgentFilesFailed(true);
        showToast({
          title: t("printer.agentFilesLoadFailed"),
          description: error instanceof Error ? error.message : "",
          tone: "error",
        });
      });
    },
    [agentFiles.length, loadAgentFiles, loadingAgentFiles, showToast, t],
  );

  function showLaoFontDownloadToast() {
    showToast({ title: t("printer.laoFontDownloadStarted"), tone: "success" });
  }

  function showDriverDownloadToast() {
    showToast({ title: t("printer.driverDownloadStarted"), tone: "success" });
  }

  function showPrinterSetupDownloadToast() {
    showToast({ title: t("printer.printerSetupDownloadStarted"), tone: "success" });
  }

  async function remove(row: Printer) {
    try {
      await removePrinter(row.print_config_uuid);
      setDeleteTarget(null);
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }

  async function testPrinter(row: Printer) {
    if (!user?.uuid || !row.print_config_uuid || testingUuid) return;
    setTestingUuid(row.print_config_uuid);
    try {
      await testPrinterAction({
        login_uuid_fk: user.uuid,
        print_config_uuid: row.print_config_uuid,
        lang: language,
      });
      showToast({ title: t("printer.testSent"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("printer.testFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setTestingUuid("");
    }
  }

  async function togglePrinter(row: Printer) {
    if (!row.print_config_uuid || togglingUuid || !user?.uuid) return;
    const wasActive = row.is_active;
    setTogglingUuid(row.print_config_uuid);
    try {
      await toggleActive(row.print_config_uuid);
      await loadPrintersForLocalAgent({
        login_uuid_fk: user.uuid,
        lang: language,
      });
      showToast({
        title: wasActive
          ? t("printer.disableSuccess")
          : t("printer.activateSuccess"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("printer.statusUpdateFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setTogglingUuid("");
    }
  }

  const listViewProps = {
    categories,
    filteredRows,
    language,
    printing,
    roleItemsByPrinter,
    statusLabels,
    testingUuid,
    togglingUuid,
    userUuid: user?.uuid,
    onDelete: setDeleteTarget,
    onTest: testPrinter,
    onToggle: togglePrinter,
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
              {t("printer.agentStatus")}: {agentStatusLabel}
            </p>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 md:hidden"
            title={`${t("printer.agentStatus")}: ${agentStatusLabel}`}
          >
            {agentStatusLabel}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="lg:hidden">
            <PrinterDownloadsMenu
              activeAgentFiles={activeAgentFiles}
              agentFilesFailed={agentFilesFailed}
              loadingAgentFiles={loadingAgentFiles}
              onAgentOpenChange={loadAgentFilesOnOpen}
              onDriverDownload={showDriverDownloadToast}
              onLaoFontDownload={showLaoFontDownloadToast}
              onPrinterSetupDownload={showPrinterSetupDownloadToast}
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
                onClick={showDriverDownloadToast}
              >
                <Download data-icon="inline-start" />
                {t("printer.installDriver")}
              </a>
            </Button>

            <DropdownMenu onOpenChange={loadAgentFilesOnOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  className="shadow-sm"
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {loadingAgentFiles ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Download data-icon="inline-start" />
                  )}
                  {t("printer.downloadAgent")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuGroup>
                  {loadingAgentFiles ? (
                    <DropdownMenuItem disabled>
                      <Spinner />
                      {t("printer.loadingAgentFiles")}
                    </DropdownMenuItem>
                  ) : agentFilesFailed ? (
                    <DropdownMenuItem disabled>
                      {t("printer.agentFilesLoadFailed")}
                    </DropdownMenuItem>
                  ) : activeAgentFiles.length ? (
                    activeAgentFiles.map((file) => {
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
                onClick={showLaoFontDownloadToast}
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
                onClick={showPrinterSetupDownloadToast}
              >
                <Download data-icon="inline-start" />
                {t("printer.downloadPrinterSetup")}
              </a>
            </Button>
          </div>

          <Link
            className={cn(buttonVariants({ size: "sm" }), "shadow-sm")}
            href="/printer/form"
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
                start: pageStart,
                end: pageEnd,
                total: printers.length,
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
                value={searchText}
                placeholder={t("settings.searchPlaceholder")}
                onChange={setSearchText}
              />
            </Field>

            <Button
              className="h-9 w-9 shrink-0"
              size="iconSm"
              variant="outline"
              aria-label={t("actions.refresh")}
              onClick={load}
            >
              <RefreshCcw />
            </Button>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                      {statusLabels.active}
                    </SelectItem>
                    <SelectItem value="inactive">
                      {statusLabels.inactive}
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
                  onClick={showLaoFontDownloadToast}
                >
                  <Download data-icon="inline-start" />
                  {t("printer.downloadLaoFont")}
                </a>
              </Button>
            </AlertDescription>
          </Alert>
        </div>

        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("printer.loading")} variant="settingsTable" />
            </div>
          ) : filteredRows.length ? (
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
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
