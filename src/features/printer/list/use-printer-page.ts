"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import type { Category } from "@/services/category";
import type { Printer } from "@/services/printer";
import type { Zone } from "@/services/zone";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { usePrinterListStore } from "@/stores/printer-list-store";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { printerListScopeKey } from "@/lib/printer-list-mode";
import { printerDiagnosticReasonKey } from "@/stores/printer-diagnostics";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { usePrinterSelfTest } from "@/features/printer/use-printer-self-test";
import { monitorPrinterAgentConnection } from "./printer-agent-monitor";
import {
  agentDownloadUrl,
  categoryLabel,
  matchesPrinterOwnership,
  OWNER_ALL,
  type PrinterOwnerFilter,
  type PrinterStatusFilter,
  printerCategories,
  roleLabel,
  STATUS_ALL,
  savedPrinterSelfTestTarget,
  TYPE_ALL,
} from "./printer-page-utils";
import {
  canManuallyTestListedPrinter,
  isUnverifiedLanPrinter,
  printerListHealth,
  printerListPresentation,
  printersInListScope,
  summarizePrinterList,
  type PrinterListScope,
} from "./printer-list-visibility";

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_ZONES: Zone[] = [];

export function usePrinterPage() {
  const { i18n, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const catalog = usePrinterListStore((state) => state.catalog);
  const catalogNetworkVisibility = usePrinterListStore((state) => state.networkVisibilityByPrinter);
  const catalogScopeKey = usePrinterListStore((state) => state.scopeKey);
  const catalogLoading = usePrinterListStore((state) => state.loading);
  const catalogCheckingNetwork = usePrinterListStore((state) => state.checkingNetwork);
  const catalogError = usePrinterListStore((state) => state.error);
  const loadCatalog = usePrinterListStore((state) => state.load);
  const invalidateNetwork = usePrinterListStore((state) => state.invalidateNetwork);
  const resetCatalog = usePrinterListStore((state) => state.reset);
  const roles = usePrinterStore((state) => state.roles);
  const operationalPrinters = usePrinterStore((state) => state.printers);
  const agentStatus = usePrinterStore((state) => state.agentStatus);
  const agentError = usePrinterStore((state) => state.agentError);
  const agentFiles = usePrinterStore((state) => state.agentFiles);
  const legacyLoading = usePrinterStore((state) => state.loading);
  const loadingAgentFiles = usePrinterStore((state) => state.loadingAgentFiles);
  const agent = usePrinterStore((state) => state.agent);
  const checkAgent = usePrinterStore((state) => state.checkAgent);
  const refreshPrinterDiagnostics = usePrinterStore((state) => state.refreshPrinterDiagnostics);
  const printerDiagnostics = usePrinterStore((state) => state.printerDiagnostics);
  const diagnosticWarnings = useMemo(() => printerDiagnostics.filter((diagnostic) =>
    diagnostic.status.state === "blocked" ||
    (diagnostic.status.state === "unknown" && diagnostic.status.reason?.endsWith("_reported")),
  ).map((diagnostic) => ({ ...diagnostic, message: t(printerDiagnosticReasonKey(diagnostic.status)) })), [printerDiagnostics, t]);
  const storageWarning = agentStatus === "connected" && (agent?.storage_status?.state === "low" || agent?.storage_status?.state === "critical")
    ? agent.storage_status.state : null;
  const {
    printing, pendingSelfTest, runSelfTest, completeSelfTest,
    selfTestSelection, selfTestProfile, setSelfTestProfile, confirmSelfTest, cancelSelfTest,
    selfTestPhase, selfTestError, checkSelfTest,
  } = usePrinterSelfTest();
  const loadPrintersForLocalAgent = usePrinterStore(
    (state) => state.loadPrintersForLocalAgent,
  );
  const loadAgentFiles = usePrinterStore((state) => state.loadAgentFiles);
  const loadRoles = usePrinterStore((state) => state.loadRoles);
  const testPrinterAction = usePrinterStore((state) => state.test);
  const testDrawerAction = usePrinterStore((state) => state.testDrawer);
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
  const [testingDrawerUuid, setTestingDrawerUuid] = useState("");
  const [testingSelfTestUuid, setTestingSelfTestUuid] = useState("");
  const [togglingUuid, setTogglingUuid] = useState("");
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState(TYPE_ALL);
  const [statusFilter, setStatusFilter] = useState<PrinterStatusFilter>(STATUS_ALL);
  const [ownerFilter, setOwnerFilter] = useState<PrinterOwnerFilter>(OWNER_ALL);
  const [listScope, setListScope] = useState<PrinterListScope>("here");
  const [agentFilesFailed, setAgentFilesFailed] = useState(false);

  const language = i18n.language;
  const storeUuid = authStoreUuid(user);
  const branchUuid = user?.branch_uuid;
  const loginUuid = user?.uuid ?? "";
  const scopeKey = JSON.stringify([loginUuid, branchUuid, storeUuid]);
  const expectedCatalogScopeKey = printerListScopeKey(loginUuid, agent?.device_code || "", scopeKey);
  const presentation = useMemo(() => printerListPresentation({
    catalog,
    networkVisibilityByPrinter: catalogNetworkVisibility,
    scopeKey: catalogScopeKey,
    loading: catalogLoading,
    checkingNetwork: catalogCheckingNetwork,
    error: catalogError,
  }, expectedCatalogScopeKey), [catalog, catalogCheckingNetwork, catalogError, catalogLoading, catalogNetworkVisibility, catalogScopeKey, expectedCatalogScopeKey]);
  const printers = presentation.catalog;
  const networkVisibilityByPrinter = presentation.networkVisibilityByPrinter;
  const checkingNetwork = presentation.checkingNetwork;
  const error = presentation.error;
  const loading = presentation.loading || legacyLoading;
  useResetOnDeps([scopeKey], () => setListScope("here"));
  const scopeRows = useMemo(
    () => printersInListScope(printers, listScope, networkVisibilityByPrinter),
    [listScope, networkVisibilityByPrinter, printers],
  );
  const hiddenLanCount = useMemo(
    () => printers.filter((row) => isUnverifiedLanPrinter(row, networkVisibilityByPrinter)).length,
    [networkVisibilityByPrinter, printers],
  );
  const manualTestPrinterUuids = useMemo(() => new Set(
    printers.filter((row) => canManuallyTestListedPrinter(row, operationalPrinters, networkVisibilityByPrinter))
      .map((row) => row.print_config_uuid),
  ), [networkVisibilityByPrinter, operationalPrinters, printers]);
  const selfTestTargets = useMemo(() => {
    const targets = new Map<string, NonNullable<ReturnType<typeof savedPrinterSelfTestTarget>>>();
    for (const row of printers) {
      if (!manualTestPrinterUuids.has(row.print_config_uuid)) continue;
      const target = savedPrinterSelfTestTarget(row, agent);
      if (target) targets.set(row.print_config_uuid, target);
    }
    return targets;
  }, [printers, agent, manualTestPrinterUuids]);
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
    return scopeRows
      .filter((printer) => {
        const matchesType =
          typeFilter === TYPE_ALL || printer.connect_type === typeFilter;
        const health = printerListHealth(printer, networkVisibilityByPrinter);
        const matchesStatus = statusFilter === "active" ? printer.is_active
          : statusFilter === "inactive" ? !printer.is_active
          : statusFilter === "attention" ? health === "unreachable" : true;
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
    scopeRows,
    networkVisibilityByPrinter,
    roles,
    searchText,
    statusFilter,
    typeFilter,
  ]);
  // Tiles describe the selected location scope before the optional list filters.
  const summary = useMemo(() => summarizePrinterList(scopeRows, networkVisibilityByPrinter), [networkVisibilityByPrinter, scopeRows]);
  const pageStart = filteredRows.length ? 1 : 0;
  const pageEnd = filteredRows.length;
  const agentStatusLabel = agentStatus === "unauthorized"
    ? t("printer.status.unauthorized")
    : agentError ?? t(`printer.status.${agentStatus}`);

  const isCurrentScope = useCallback(() => {
    const currentUser = useAuthStore.getState().user;
    return JSON.stringify([currentUser?.uuid ?? "", currentUser?.branch_uuid, authStoreUuid(currentUser)]) === scopeKey;
  }, [scopeKey]);

  const refreshCatalog = useCallback(async () => {
    if (!loginUuid || !isCurrentScope()) return;
    // A previous page/session may finish its Agent lookup after the new one.
    // Do not let that old callback start a newer request for the wrong scope.
    const current = usePrinterStore.getState();
    await loadCatalog({
      login_uuid_fk: loginUuid,
      lang: language,
      device_code: current.agent?.device_code || undefined,
    }, { agent: current.agent, connected: current.agentStatus === "connected", scopeKey });
  }, [isCurrentScope, language, loadCatalog, loginUuid, scopeKey]);

  const load = useCallback(async () => {
    if (!loginUuid || !isCurrentScope()) return;
    invalidateNetwork();
    try {
      const resources = await Promise.allSettled([
        loadPrintersForLocalAgent({ login_uuid_fk: loginUuid, lang: language }),
        loadRoles(language),
        storeUuid ? loadCategories(language, storeUuid) : Promise.resolve([]),
        loadZones(language, branchUuid),
      ]);
      await refreshCatalog();
      await refreshPrinterDiagnostics();
      const failedResource = resources.find((result) => result.status === "rejected");
      if (failedResource?.status === "rejected") throw failedResource.reason;
    } catch (error) {
      if (!isCurrentScope()) return;
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
    invalidateNetwork,
    isCurrentScope,
    loadPrintersForLocalAgent,
    refreshPrinterDiagnostics,
    refreshCatalog,
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

  useEffect(() => {
    if (!loginUuid) return;
    const monitor = monitorPrinterAgentConnection(async () => {
      if (!isCurrentScope()) return;
      invalidateNetwork();
      await checkAgent();
      await Promise.all([refreshCatalog(), refreshPrinterDiagnostics()]);
    });
    const nativeListener = isCapacitorMobileApp()
      ? import("@capacitor/app").then(({ App }) => App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void monitor.refresh();
        })).catch(() => null)
      : Promise.resolve(null);
    return () => {
      monitor.stop();
      void nativeListener.then((listener) => listener?.remove()).catch(() => undefined);
    };
  }, [checkAgent, invalidateNetwork, isCurrentScope, refreshCatalog, refreshPrinterDiagnostics, loginUuid]);

  useEffect(() => () => resetCatalog(), [resetCatalog]);

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
      void refreshCatalog().catch(() => undefined);
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }

  async function testPrinter(row: Printer) {
    if (!user?.uuid || !row.print_config_uuid || testingUuid || printing || pendingSelfTest ||
        !canManuallyTestListedPrinter(row, usePrinterStore.getState().printers,
          usePrinterListStore.getState().networkVisibilityByPrinter)) return;
    setTestingUuid(row.print_config_uuid);
    try {
      const routingWarning = await testPrinterAction({
        login_uuid_fk: user.uuid,
        print_config_uuid: row.print_config_uuid,
        lang: language,
      });
      showToast({
        title: t("common.printSuccess"),
        // The page printed, but real orders may still route elsewhere.
        description: routingWarning || t("printer.testSent"),
        tone: routingWarning ? "warning" : "success",
      });
    } catch (error) {
      showToast({
        title: t("printer.testFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
        action: {
          label: t("actions.tryAgain"),
          onClick: () => void testPrinter(row),
        },
      });
    } finally {
      setTestingUuid("");
    }
  }

  async function testDrawer(row: Printer) {
    if (!user?.uuid || !row.print_config_uuid || testingDrawerUuid || printing || pendingSelfTest ||
        !canManuallyTestListedPrinter(row, usePrinterStore.getState().printers,
          usePrinterListStore.getState().networkVisibilityByPrinter)) return;
    setTestingDrawerUuid(row.print_config_uuid);
    try {
      const { routingWarning, cashDrawerEnabled } = await testDrawerAction({
        login_uuid_fk: user.uuid,
        print_config_uuid: row.print_config_uuid,
        lang: language,
      });
      if (!cashDrawerEnabled) {
        showToast({
          title: t("printer.drawerDisabledForPrinter"),
          tone: "warning",
        });
        return;
      }
      showToast({
        title: t("printer.drawerTestSent"),
        description: routingWarning || "",
        tone: routingWarning ? "warning" : "success",
      });
    } catch (error) {
      showToast({
        title: t("printer.drawerTestFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setTestingDrawerUuid("");
    }
  }

  async function testSelfTest(row: Printer) {
    const target = selfTestTargets.get(row.print_config_uuid);
    if (!target || !user?.uuid || printing || pendingSelfTest || testingSelfTestUuid ||
        !canManuallyTestListedPrinter(row, usePrinterStore.getState().printers,
          usePrinterListStore.getState().networkVisibilityByPrinter)) return;
    setTestingSelfTestUuid(row.print_config_uuid);
    try {
      await runSelfTest(target);
    } finally {
      setTestingSelfTestUuid("");
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
      await refreshCatalog();
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
    listScope,
    setListScope,
    scopeTotal: scopeRows.length,
    hiddenLanCount,
    checkingNetwork,
    networkVisibilityByPrinter,
    manualTestPrinterUuids,
    error,
    printing,
    pendingSelfTest,
    completeSelfTest,
    selfTestSelection, selfTestProfile, setSelfTestProfile, confirmSelfTest, cancelSelfTest,
    selfTestPhase, selfTestError, checkSelfTest,
    selfTestTargets,
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
    agentStatus,
    agentStatusLabel,
    diagnosticWarnings,
    storageWarning,
    summary,
    loading,
    deleteTarget,
    testingUuid,
    testingDrawerUuid,
    testingSelfTestUuid,
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
    testDrawer,
    testSelfTest,
    togglePrinter,
  };
}

export type PrinterPageWorkflow = ReturnType<typeof usePrinterPage>;
