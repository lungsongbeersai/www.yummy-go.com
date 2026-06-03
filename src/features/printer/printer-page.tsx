"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { icons as mdiIcons } from "@iconify-json/mdi";
import { Icon as IconifyIcon, addCollection } from "@iconify/react";
import { Download, Plus, Power, PowerOff, Printer as PrinterIcon, RefreshCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { cn } from "@/lib/utils";
import type { Category } from "@/services/category";
import type { Printer, PrinterCategory, PrinterRole } from "@/services/printer";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

const EMPTY_CATEGORIES: Category[] = [];
const TYPE_ALL = "all";
const STATUS_ALL = "all";
const AGENT_PLATFORM_ICONS: Record<string, string> = {
  windows: "mdi:microsoft-windows",
  macos: "mdi:apple"
};

addCollection(mdiIcons);

type PrinterTableRow = Printer & { row_number: number };

function roleLabel(code: string, roles: PrinterRole[]) {
  return roles.find((role) => role.role_code === code)?.role_name ?? code;
}

function categoryLabel(category: Category | PrinterCategory, language: string) {
  const english = language.startsWith("en");
  const primary = english ? category.cate_name_eng : category.cate_name_la;
  const fallback = english ? category.cate_name_la : category.cate_name_eng;
  return primary || fallback || category.cate_name || category.cate_uuid;
}

function printerCategories(printer: Printer, categories: Category[]) {
  if (printer.categories?.length) return printer.categories;
  return printer.cate_uuid_fk
    .map((uuid) => categories.find((category) => category.cate_uuid === uuid))
    .filter((category): category is Category => Boolean(category));
}

function BadgeList({
  emptyLabel,
  items
}: {
  emptyLabel: string;
  items: Array<{ label: string; value: string }>;
}) {
  if (!items.length) return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;

  return (
    <div className="flex max-w-64 flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={item.value} className="max-w-full truncate">
          {item.label}
        </Badge>
      ))}
    </div>
  );
}

function PrinterStatusBadge({ active, label }: { active: boolean; label: string }) {
  const Icon = active ? Power : PowerOff;

  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-1 font-black whitespace-nowrap",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </Badge>
  );
}

function agentDownloadUrl(file: { download_url?: string }) {
  return typeof file.download_url === "string" ? file.download_url.trim() : "";
}

function AgentPlatformIcon({ platform }: { platform: string }) {
  const icon = AGENT_PLATFORM_ICONS[platform.trim().toLowerCase()];

  if (!icon) return <Download aria-hidden="true" />;

  return <IconifyIcon aria-hidden="true" icon={icon} className="size-4" />;
}

export function PrinterPage() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
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
  const loadPrintersForLocalAgent = usePrinterStore((state) => state.loadPrintersForLocalAgent);
  const loadAgentFiles = usePrinterStore((state) => state.loadAgentFiles);
  const loadRoles = usePrinterStore((state) => state.loadRoles);
  const testPrinterAction = usePrinterStore((state) => state.test);
  const toggleActive = usePrinterStore((state) => state.toggleActive);
  const removePrinter = usePrinterStore((state) => state.remove);
  const categories = (useReferenceStore((state) => state.options.categories) ?? EMPTY_CATEGORIES) as Category[];
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
          printer.role_codes.map((code) => ({ label: roleLabel(code, roles), value: code }))
        ])
      ),
    [printers, roles]
  );
  const statusLabels = useMemo(() => {
    return {
      active: t("printer.enabledStatus"),
      inactive: t("printer.disabledStatus")
    };
  }, [t]);
  const activeAgentFiles = useMemo(
    () => agentFiles.filter((file) => Number(file.file_status) === 1 && agentDownloadUrl(file)),
    [agentFiles]
  );
  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return printers
      .filter((printer) => {
        const matchesType = typeFilter === TYPE_ALL || printer.connect_type === typeFilter;
        const matchesStatus =
          statusFilter === STATUS_ALL ||
          (statusFilter === "active" ? printer.is_active : !printer.is_active);
        const roleText = printer.role_codes.map((code) => roleLabel(code, roles)).join(" ");
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
          categoryText
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return matchesType && matchesStatus && (!query || searchable.includes(query));
      })
      .map((printer, index) => ({ ...printer, row_number: index + 1 }));
  }, [categories, language, printers, roles, searchText, statusFilter, typeFilter]);
  const pageStart = filteredRows.length ? 1 : 0;
  const pageEnd = filteredRows.length;

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
        tone: "error"
      });
    }
  }, [language, loadCategories, loadPrintersForLocalAgent, loadRoles, showToast, storeUuid, t, user?.uuid]);

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
          tone: "error"
        });
      });
    },
    [agentFiles.length, loadAgentFiles, loadingAgentFiles, showToast, t]
  );

  async function remove(row: Printer) {
    try {
      await removePrinter(row.print_config_uuid);
      setDeleteTarget(null);
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
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
        lang: language
      });
      showToast({ title: t("printer.testSent"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("printer.testFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
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
      await loadPrintersForLocalAgent({ login_uuid_fk: user.uuid, lang: language });
      showToast({
        title: wasActive ? t("printer.disableSuccess") : t("printer.activateSuccess"),
        tone: "success"
      });
    } catch (error) {
      showToast({
        title: t("printer.statusUpdateFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setTogglingUuid("");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">{t("printer.title")}</p>
          <h1 className="mt-1 text-xl font-black">{t("printer.subtitle")}</h1>
          <p className="mt-0.5 hidden max-w-2xl truncate text-xs text-muted-foreground sm:block">
            {t("printer.agentStatus")}: {agentError ?? t(`printer.status.${agentStatus}`)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <DropdownMenu onOpenChange={loadAgentFilesOnOpen}>
            <DropdownMenuTrigger asChild>
              <Button className="shadow-sm" size="sm" type="button" variant="outline">
                {loadingAgentFiles ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
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
                  <DropdownMenuItem disabled>{t("printer.agentFilesLoadFailed")}</DropdownMenuItem>
                ) : activeAgentFiles.length ? (
                  activeAgentFiles.map((file) => {
                    const platformKey = file.file_platform.trim().toLowerCase();
                    const platformLabel = t(`printer.agentPlatform.${platformKey}`, {
                      defaultValue: file.file_platform || t("printer.agent")
                    });
                    const url = agentDownloadUrl(file);

                    return (
                      <DropdownMenuItem key={file.agent_file_uuid} asChild>
                        <a href={url} target="_blank" rel="noreferrer" download={file.file_name}>
                          <AgentPlatformIcon platform={file.file_platform} />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-semibold">{platformLabel}</span>
                            <span className="truncate text-xs text-muted-foreground">{file.file_name}</span>
                          </span>
                        </a>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <DropdownMenuItem disabled>{t("printer.noAgentFiles")}</DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link className={cn(buttonVariants({ size: "sm" }), "shadow-sm")} href="/printer/form">
            <Plus data-icon="inline-start" />
            {t("actions.add")} {t("printer.title")}
          </Link>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        <CardHeader className="shrink-0 flex-col gap-3 px-4 py-3 lg:flex-row lg:px-5">
          <div className="min-w-0 flex-1">
            <CardTitle>{t("printer.title")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total: printers.length })}
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto] lg:w-auto">
            <Field className="gap-1">
              <FieldLabel htmlFor="printer-search-filter" className="text-xs font-bold text-muted-foreground">
                {t("actions.search")}
              </FieldLabel>
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="printer-search-filter"
                  className="h-8 pl-9 text-sm"
                  value={searchText}
                  placeholder={t("settings.searchPlaceholder")}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
            </Field>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <Field className="gap-1">
                <FieldLabel htmlFor="printer-type-filter" className="text-xs font-bold text-muted-foreground">
                  {t("fields.connectType")}
                </FieldLabel>
                <SelectTrigger id="printer-type-filter" className="h-8 w-full font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value={TYPE_ALL}>{t("printer.allTypes")}</SelectItem>
                    <SelectItem value="tcp">{t("printer.tcpPrinter")}</SelectItem>
                    <SelectItem value="usb">{t("printer.usbPrinter")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Field>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <Field className="gap-1">
                <FieldLabel htmlFor="printer-status-filter" className="text-xs font-bold text-muted-foreground">
                  {t("common.status")}
                </FieldLabel>
                <SelectTrigger id="printer-status-filter" className="h-8 w-full font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value={STATUS_ALL}>{t("printer.allStatuses")}</SelectItem>
                    <SelectItem value="active">{statusLabels.active}</SelectItem>
                    <SelectItem value="inactive">{statusLabels.inactive}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Field>
            </Select>
            <div className="flex items-end">
              <Button className="w-full" size="sm" variant="outline" onClick={load}>
                <RefreshCcw data-icon="inline-start" />
                {t("actions.refresh")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("printer.loading")} variant="table" />
            </div>
          ) : filteredRows.length ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <DataTable<PrinterTableRow>
                rows={filteredRows}
                idKey="print_config_uuid"
                columns={[
                  {
                    key: "row_number",
                    label: "#",
                    align: "center",
                    className: "w-14 font-black text-muted-foreground"
                  },
                  {
                    key: "printer_name",
                    label: t("fields.name"),
                    render: (row) => (
                      <div className="flex min-w-44 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                          <PrinterIcon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-black">{row.printer_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{row.device_code || row.agent_name || "-"}</p>
                        </div>
                      </div>
                    )
                  },
                  {
                    key: "connect_type",
                    label: t("fields.connectType"),
                    render: (row) => <Badge>{row.connect_type.toUpperCase()}</Badge>
                  },
                  {
                    key: "interface_value",
                    label: t("fields.interfaceValue"),
                    className: "min-w-56 text-xs"
                  },
                  {
                    key: "role_codes",
                    label: t("printer.roles"),
                    render: (row) => (
                      <BadgeList
                        emptyLabel={t("printer.noRoles")}
                        items={roleItemsByPrinter.get(row.print_config_uuid) ?? []}
                      />
                    )
                  },
                  {
                    key: "categories",
                    label: t("printer.categories"),
                    render: (row) => (
                      <BadgeList
                        emptyLabel={t("printer.noCategories")}
                        items={printerCategories(row, categories).map((category) => ({
                          label: categoryLabel(category, language),
                          value: category.cate_uuid
                        }))}
                      />
                    )
                  },
                  {
                    key: "is_active",
                    label: t("common.status"),
                    className: "min-w-32 whitespace-nowrap",
                    headClassName: "min-w-32",
                    render: (row) => (
                      <PrinterStatusBadge
                        active={row.is_active}
                        label={row.is_active ? statusLabels.active : statusLabels.inactive}
                      />
                    )
                  }
                ]}
                actions={[
                  {
                    id: "test-printer",
                    label: (row) =>
                      testingUuid === row.print_config_uuid ? t("printer.testingPrinter") : t("printer.testPrinter"),
                    icon: (row) =>
                      testingUuid === row.print_config_uuid ? (
                        <Spinner />
                      ) : (
                        <PrinterIcon />
                      ),
                    disabled: (row) =>
                      printing || Boolean(testingUuid) || Boolean(togglingUuid) || !user?.uuid || !row.print_config_uuid,
                    keepOpenOnSelect: true,
                    onSelect: (row) => void testPrinter(row)
                  },
                  {
                    id: "toggle-active",
                    label: (row) => (row.is_active ? t("printer.disablePrinter") : t("printer.activatePrinter")),
                    icon: (row) =>
                      togglingUuid === row.print_config_uuid ? (
                        <Spinner />
                      ) : row.is_active ? (
                        <PowerOff />
                      ) : (
                        <Power />
                      ),
                    disabled: (row) => Boolean(togglingUuid) || !row.print_config_uuid,
                    keepOpenOnSelect: true,
                    onSelect: (row) => void togglePrinter(row)
                  }
                ]}
                onEdit={(row) => router.push(`/printer/form?print_config_uuid=${encodeURIComponent(row.print_config_uuid)}`)}
                onDelete={(row) => setDeleteTarget(row)}
              />
            </div>
          ) : (
            <div className="flex min-h-72 flex-1 items-center justify-center p-4">
              <EmptyState title={t("printer.noPrinters")} description={t("printer.noPrintersDescription")} />
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
