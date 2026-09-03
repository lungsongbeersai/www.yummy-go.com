"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Category } from "@/services/category";
import type { Printer } from "@/services/printer";
import type { Zone } from "@/services/zone";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import {
  agentDownloadUrl,
  categoryLabel,
  matchesPrinterOwnership,
  OWNER_ALL,
  type PrinterOwnerFilter,
  printerCategories,
  roleLabel,
  STATUS_ALL,
  TYPE_ALL,
} from "./printer-page-utils";

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_ZONES: Zone[] = [];

export function usePrinterPage() {
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
  const zones = (useReferenceStore((state) => state.options.zones) ??
    EMPTY_ZONES) as Zone[];
  const loadZones = useReferenceStore((state) => state.loadZones);
  const [deleteTarget, setDeleteTarget] = useState<Printer | null>(null);
  const [testingUuid, setTestingUuid] = useState("");
  const [togglingUuid, setTogglingUuid] = useState("");
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [ownerFilter, setOwnerFilter] = useState<PrinterOwnerFilter>(OWNER_ALL);
  const [agentFilesFailed, setAgentFilesFailed] = useState(false);

  const language = i18n.language;
  const storeUuid = authStoreUuid(user);
  const branchUuid = user?.branch_uuid;
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
        const matchesOwner = matchesPrinterOwnership(printer, ownerFilter);
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
          matchesType &&
          matchesStatus &&
          matchesOwner &&
          (!query || searchable.includes(query))
        );
      })
      .map((printer, index) => ({ ...printer, row_number: index + 1 }));
  }, [
    categories,
    language,
    ownerFilter,
    printers,
    roles,
    searchText,
    statusFilter,
    typeFilter,
  ]);
  const pageStart = filteredRows.length ? 1 : 0;
  const pageEnd = filteredRows.length;
  const agentStatusLabel = agentError ?? t(`printer.status.${agentStatus}`);

  const loginUuid = user?.uuid ?? "";

  const load = useCallback(async () => {
    if (!loginUuid) return;
    try {
      await Promise.all([
        loadPrintersForLocalAgent({ login_uuid_fk: loginUuid, lang: language }),
        loadRoles(language),
        storeUuid ? loadCategories(language, storeUuid) : Promise.resolve([]),
        loadZones(language, branchUuid),
      ]);
    } catch (error) {
      showToast({
        title: t("printer.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [
    branchUuid,
    language,
    loadCategories,
    loadPrintersForLocalAgent,
    loadRoles,
    loadZones,
    loginUuid,
    showToast,
    storeUuid,
    t,
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
      const routingWarning = await testPrinterAction({
        login_uuid_fk: user.uuid,
        print_config_uuid: row.print_config_uuid,
        lang: language,
      });
      showToast({
        title: t("printer.testSent"),
        // The page printed, but real orders may still route elsewhere.
        description: routingWarning || "",
        tone: routingWarning ? "warning" : "success",
      });
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

  return {
    t,
    language,
    user,
    printers,
    printing,
    categories,
    zones,
    roleItemsByPrinter,
    statusLabels,
    activeAgentFiles,
    agentFilesFailed,
    loadingAgentFiles,
    filteredRows,
    pageStart,
    pageEnd,
    agentStatusLabel,
    loading,
    deleteTarget,
    testingUuid,
    togglingUuid,
    searchText,
    typeFilter,
    statusFilter,
    ownerFilter,
    setDeleteTarget,
    setSearchText,
    setTypeFilter,
    setStatusFilter,
    setOwnerFilter,
    load,
    loadAgentFilesOnOpen,
    showLaoFontDownloadToast,
    showDriverDownloadToast,
    showPrinterSetupDownloadToast,
    remove,
    testPrinter,
    togglePrinter,
  };
}

export type PrinterPageWorkflow = ReturnType<typeof usePrinterPage>;
