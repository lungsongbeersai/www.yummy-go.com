"use client";

import { create } from "zustand";
import {
  ackPrintJob,
  buildTestJob,
  deletePrinter,
  dispatchPrintJob,
  executeInvoicePrintJobs,
  executeKitchenPrintJobs,
  executeReportPrintJobs,
  getAgentFiles,
  fetchPrinterCategoryRole,
  getCategoryRoles,
  getDefaultCategoryByRole,
  getPrinterErrorMessage,
  getPendingPrintJobs,
  getPrinterOptions,
  getPrinterRoles,
  getPrinters,
  resolvePrinterDeviceContext,
  resolvePrinterDeviceIdentity,
  resolvePrintersByCategory,
  saveCategoryPrinter,
  saveCategoryRole,
  savePrinter,
  searchPrinters,
  togglePrinterActive,
  type AckPayload,
  type AgentFile,
  type AgentInfo,
  type BuildTestJobRequest,
  type CategoryRole,
  type DefaultCategoryByRoleInput,
  type ExecuteInvoicePrintInput,
  type ExecuteKitchenPrintInput,
  type ExecuteReportPrintInput,
  type FetchPrintersForLocalAgentParams,
  type FetchPrintersParams,
  type PendingPrintJobData,
  type Printer,
  type PrinterCategoryRole,
  type PrinterDeviceContext,
  type PrinterDeviceContextParams,
  type PrinterRole,
  type ResolvedPrinter,
  type SaveCategoryPrinterInput,
  type SaveCategoryRoleInput,
  type SavePrinterInput,
  type SearchPrinterResult,
  renderMobileEscpos
} from "@/services/printer";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";
import { printMobileEscposOverTcp } from "@/services/printer/mobile-tcp";
import { Capacitor } from "@capacitor/core";
import { printReport, type ReportPrintInput, type ReportPrintResponse } from "@/services/report";

type AgentStatus = "unchecked" | "connected" | "offline";

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

interface PrinterState {
  printers: Printer[];
  options: Printer[];
  agentFiles: AgentFile[];
  found: SearchPrinterResult[];
  roles: PrinterRole[];
  categoryRoles: CategoryRole[];
  printerCategoryRole: PrinterCategoryRole | null;
  resolvedPrinters: ResolvedPrinter[];
  pendingJobs: PendingPrintJobData[];
  agent: AgentInfo | null;
  agentStatus: AgentStatus;
  agentError: string | null;
  loading: boolean;
  loadingAgentFiles: boolean;
  searching: boolean;
  saving: boolean;
  printing: boolean;
  error: string | null;
  loadPrinters: (params: FetchPrintersParams) => Promise<Printer[]>;
  loadPrintersForLocalAgent: (params: FetchPrintersForLocalAgentParams) => Promise<Printer[]>;
  loadOptions: (loginUuid: string, lang?: string) => Promise<Printer[]>;
  loadAgentFiles: () => Promise<AgentFile[]>;
  discover: (mode?: "usb" | "network") => Promise<SearchPrinterResult[]>;
  checkAgent: (agentUrl?: string) => Promise<boolean>;
  resolveDeviceIdentity: (agentUrl?: string) => Promise<AgentInfo>;
  loadRoles: (lang?: string) => Promise<PrinterRole[]>;
  save: (input: SavePrinterInput) => Promise<Printer>;
  remove: (printConfigUuid: string) => Promise<void>;
  toggleActive: (printConfigUuid: string) => Promise<void>;
  buildTest: (data: BuildTestJobRequest) => ReturnType<typeof buildTestJob>;
  test: (data: BuildTestJobRequest) => Promise<string | null>;
  loadCategoryRoles: (loginUuid: string) => Promise<CategoryRole[]>;
  saveCategoryRole: (input: SaveCategoryRoleInput) => Promise<void>;
  loadPrinterCategoryRole: (loginUuid: string, printerUuid: string, lang?: string) => Promise<PrinterCategoryRole | null>;
  saveCategoryPrinter: (input: SaveCategoryPrinterInput) => Promise<void>;
  resolveByCategory: (loginUuid: string, categoryUuids: string[]) => Promise<ResolvedPrinter[]>;
  resolveDeviceContext: (params: PrinterDeviceContextParams) => Promise<PrinterDeviceContext>;
  getDefaultCategoryByRole: (input: DefaultCategoryByRoleInput) => ReturnType<typeof getDefaultCategoryByRole>;
  loadPendingJobs: (printJobUuid: string, loginUuid: string) => Promise<PendingPrintJobData[]>;
  ack: (payload: AckPayload) => ReturnType<typeof ackPrintJob>;
  executeKitchen: (input: ExecuteKitchenPrintInput) => ReturnType<typeof executeKitchenPrintJobs>;
  executeInvoice: (input: ExecuteInvoicePrintInput) => ReturnType<typeof executeInvoicePrintJobs>;
  executeReport: (input: ExecuteReportPrintInput) => ReturnType<typeof executeReportPrintJobs>;
  submitReportPrint: (input: ReportPrintInput) => Promise<ReportPrintResponse>;
  reset: () => void;
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  printers: [],
  options: [],
  agentFiles: [],
  found: [],
  roles: [],
  categoryRoles: [],
  printerCategoryRole: null,
  resolvedPrinters: [],
  pendingJobs: [],
  agent: null,
  agentStatus: "unchecked",
  agentError: null,
  loading: false,
  loadingAgentFiles: false,
  searching: false,
  saving: false,
  printing: false,
  error: null,
  loadPrinters: async (params) => {
    const isCurrentSession = createSessionGuard();
    set({ loading: true, error: null });
    try {
      const printers = await getPrinters(params);
      if (isCurrentSession()) set({ printers, loading: false });
      return printers;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  loadPrintersForLocalAgent: async (params) => {
    const isCurrentSession = createSessionGuard();
    set({ loading: true, error: null });

    const result = await resolvePrinterDeviceIdentity();
    if (!isCurrentSession()) return [];

    const agent = result.ok ? result.agent : null;
    const agentId = textValue(agent?.agent_id);
    const deviceCode = textValue(agent?.device_code);

    if (!result.ok || !agentId || !deviceCode) {
      const error = result.ok ? "Printer device identity missing" : result.error;
      if (isCurrentSession()) {
        set({
          printers: [],
          agent,
          agentStatus: "offline",
          agentError: error,
          error,
          loading: false
        });
      }
      return [];
    }

    if (isCurrentSession()) set({ agent, agentStatus: "connected", agentError: null });

    try {
      const printers = await getPrinters({
        ...params,
        agent_id: agentId,
        device_code: deviceCode
      });
      if (isCurrentSession()) set({ printers, loading: false });
      return printers;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  loadOptions: async (loginUuid, lang) => {
    const isCurrentSession = createSessionGuard();
    const options = await getPrinterOptions(loginUuid, lang);
    if (isCurrentSession()) set({ options });
    return options;
  },
  loadAgentFiles: async () => {
    const isCurrentSession = createSessionGuard();
    set({ loadingAgentFiles: true, error: null });
    try {
      const agentFiles = await getAgentFiles();
      if (isCurrentSession()) set({ agentFiles, loadingAgentFiles: false });
      return agentFiles;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loadingAgentFiles: false });
      throw error;
    }
  },
  discover: async (mode = "usb") => {
    const isCurrentSession = createSessionGuard();
    set({ searching: true, error: null });
    try {
      const result = await searchPrinters(mode);
      if (isCurrentSession()) {
        set({
          found: result.printers,
          agent: result.agent,
          agentStatus: result.agent ? "connected" : "unchecked",
          agentError: null,
          searching: false
        });
      }
      return result.printers;
    } catch (error) {
      if (isCurrentSession()) {
        set({ error: errorMessage(error), agentStatus: "offline", agentError: errorMessage(error), searching: false });
      }
      throw error;
    }
  },
  checkAgent: async (agentUrl) => {
    const isCurrentSession = createSessionGuard();
    const result = await resolvePrinterDeviceIdentity(agentUrl);
    if (isCurrentSession()) {
      set({
        agent: result.ok ? result.agent ?? null : null,
        agentStatus: result.ok ? "connected" : "offline",
        agentError: result.ok ? null : result.error ?? null
      });
    }
    return result.ok;
  },
  resolveDeviceIdentity: async (agentUrl) => {
    const isCurrentSession = createSessionGuard();
    const result = await resolvePrinterDeviceIdentity(agentUrl);
    if (isCurrentSession()) {
      set({
        agent: result.ok ? result.agent ?? null : null,
        agentStatus: result.ok ? "connected" : "offline",
        agentError: result.ok ? null : result.error ?? null
      });
    }
    if (!result.ok) throw new Error(result.error);
    return result.agent;
  },
  loadRoles: async (lang) => {
    const isCurrentSession = createSessionGuard();
    const roles = await getPrinterRoles(lang);
    if (isCurrentSession()) set({ roles });
    return roles;
  },
  save: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      const printer = await savePrinter(input);
      if (isCurrentSession()) {
        set((state) => {
          const exists = state.printers.some((item) => item.print_config_uuid === printer.print_config_uuid);
          return {
            printers: exists
              ? state.printers.map((item) =>
                item.print_config_uuid === printer.print_config_uuid ? printer : item
              )
              : printer.print_config_uuid
                ? [printer, ...state.printers]
                : state.printers,
            saving: false
          };
        });
      }
      return printer;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  remove: async (printConfigUuid) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      await deletePrinter(printConfigUuid, textValue(get().agent?.device_code));
      if (isCurrentSession()) {
        set((state) => ({
          printers: state.printers.filter((printer) => printer.print_config_uuid !== printConfigUuid),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  toggleActive: async (printConfigUuid) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      await togglePrinterActive(printConfigUuid, textValue(get().agent?.device_code));
      if (isCurrentSession()) {
        set((state) => ({
          printers: state.printers.map((printer) =>
            printer.print_config_uuid === printConfigUuid ? { ...printer, is_active: !printer.is_active } : printer
          ),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  buildTest: (data) => buildTestJob(data),
  test: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ printing: true, error: null });

    let phase = "start";

    try {
      console.log("[printer-test] start", input);

      const selectedPrinter = get().printers.find(
        (item) =>
          input.print_config_uuid &&
          item.print_config_uuid === input.print_config_uuid,
      );

      const selectedConnectType = textValue(selectedPrinter?.connect_type).toLowerCase();
      const nativeTcpPrinter =
        Capacitor.isNativePlatform() && selectedConnectType === "tcp";

      phase = "resolvePrinterDeviceContext";

      const printer = nativeTcpPrinter
        ? {
          device_code: selectedPrinter?.device_code,
          agent_id: selectedPrinter?.agent_id,
          agent_name: selectedPrinter?.agent_name,
          print_mode: selectedPrinter?.print_mode,
          connect_type: selectedPrinter?.connect_type,
        }
        : await resolvePrinterDeviceContext(input);
      if (!isCurrentSession()) return null;

      console.log("[printer-test] printer", printer);

      phase = "buildTestJob";

      const result = await buildTestJob({
        ...input,
        // Build the test job against the row the user actually selected. The
        // browser identity and installed Agent identity are allowed to differ.
        device_code: selectedPrinter?.device_code || printer.device_code,
        agent_id: selectedPrinter?.agent_id || printer.agent_id,
        agent_name: selectedPrinter?.agent_name || printer.agent_name,
        print_mode: selectedPrinter?.print_mode || printer.print_mode,
      });
      if (!isCurrentSession()) return null;

      const job = result.data.job;
      // The API prints the selected row even when routing sends real orders to
      // another config at the same address, and says so here.
      const routingWarning = result.data.routing_warning?.trim() || null;
      console.log("[printer-test] job", job);

      const printerConnectType = textValue(
        (printer as { connect_type?: string | null }).connect_type,
      ).toLowerCase();

      const jobConnectType = textValue(
        (job as { connect_type?: string | null }).connect_type,
      ).toLowerCase();

      const isNativeApp = Capacitor.isNativePlatform();

      const isMobileWifi =
        isNativeApp &&
        (
          textValue(printer.print_mode).toLowerCase() === "mobile_wifi" ||
          textValue(job.print_mode).toLowerCase() === "mobile_wifi" ||
          textValue(job.print_client).toLowerCase() === "mobile_wifi" ||
          nativeTcpPrinter ||
          printerConnectType === "tcp" ||
          jobConnectType === "tcp"
        );

      // console.log("[printer-test] mode", {
      //   isNative: Capacitor.isNativePlatform(),
      //   selectedConnectType,
      //   nativeTcpPrinter,
      //   printerConnectType,
      //   jobConnectType,
      //   printerPrintMode: printer.print_mode,
      //   jobPrintMode: job.print_mode,
      //   jobPrintClient: job.print_client,
      //   isMobileWifi,
      // });

      if (isMobileWifi) {
        phase = "renderMobileEscpos";
        const escposBase64 = await renderMobileEscpos(job);
        if (!isCurrentSession()) return null;

        console.log("[printer-test] escposBase64 length", escposBase64.length);

        phase = "printMobileEscposOverTcp";
        await printMobileEscposOverTcp({
          interface_value: job.interface_value,
          escpos_base64: escposBase64,
        });
      } else {
        phase = "dispatchPrintJob";
        await dispatchPrintJob(job);
      }

      phase = "done";
      if (isCurrentSession()) set({ printing: false });
      return routingWarning;
    } catch (error) {
      const message = getPrinterErrorMessage(error);
      const finalMessage = `[${phase}] ${message}`;

      console.error("[printer-test] failed", {
        phase,
        error,
      });

      if (isCurrentSession()) set({ error: finalMessage, printing: false });
      throw new Error(finalMessage);
    }

  },
  loadCategoryRoles: async (loginUuid) => {
    const isCurrentSession = createSessionGuard();
    const categoryRoles = await getCategoryRoles(loginUuid);
    if (isCurrentSession()) set({ categoryRoles });
    return categoryRoles;
  },
  saveCategoryRole: (input) => saveCategoryRole(input),
  loadPrinterCategoryRole: async (loginUuid, printerUuid, lang) => {
    const isCurrentSession = createSessionGuard();
    const printerCategoryRole = await fetchPrinterCategoryRole(loginUuid, printerUuid, lang);
    if (isCurrentSession()) set({ printerCategoryRole });
    return printerCategoryRole;
  },
  saveCategoryPrinter: (input) => saveCategoryPrinter(input),
  resolveByCategory: async (loginUuid, categoryUuids) => {
    const isCurrentSession = createSessionGuard();
    const resolvedPrinters = await resolvePrintersByCategory(loginUuid, categoryUuids);
    if (isCurrentSession()) set({ resolvedPrinters });
    return resolvedPrinters;
  },
  resolveDeviceContext: (params) => resolvePrinterDeviceContext(params),
  getDefaultCategoryByRole: (input) => getDefaultCategoryByRole(input),
  loadPendingJobs: async (printJobUuid, loginUuid) => {
    const isCurrentSession = createSessionGuard();
    const printer = await resolvePrinterDeviceContext({ login_uuid_fk: loginUuid });
    if (!isCurrentSession()) return [];

    const result = await getPendingPrintJobs({
      print_job_uuid: printJobUuid,
      login_uuid_fk: loginUuid,
      device_code: printer.device_code,
      agent_id: printer.agent_id,
      print_mode: printer.print_mode
    });
    const pendingJobs = result.jobs;
    if (isCurrentSession()) set({ pendingJobs });
    return pendingJobs;
  },
  ack: (payload) => ackPrintJob(payload),
  executeKitchen: (input) => executeKitchenPrintJobs(input),
  executeInvoice: (input) => executeInvoicePrintJobs(input),
  executeReport: (input) => executeReportPrintJobs(input),
  submitReportPrint: (input) => printReport(input),
  reset: () =>
    set({
      printers: [],
      options: [],
      agentFiles: [],
      found: [],
      roles: [],
      categoryRoles: [],
      printerCategoryRole: null,
      resolvedPrinters: [],
      pendingJobs: [],
      agent: null,
      agentStatus: "unchecked",
      agentError: null,
      loading: false,
      loadingAgentFiles: false,
      searching: false,
      saving: false,
      printing: false,
      error: null
    })
}));

registerSessionStoreReset("printer", () => usePrinterStore.getState().reset());
