"use client";

import { create } from "zustand";
import {
  ackPrintJob,
  buildTestJob,
  deletePrinter,
  executeKitchenPrintJobs,
  getAgentFiles,
  fetchPrinterCategoryRole,
  getCategoryRoles,
  getDefaultCategoryByRole,
  getPendingPrintJobs,
  getPrinterOptions,
  getPrinterRoles,
  getPrinters,
  printOps,
  printTableQRJob,
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
  type ExecuteKitchenPrintInput,
  type FetchPrintersForLocalAgentParams,
  type FetchPrintersParams,
  type PendingPrintJobData,
  type PrintJob,
  type Printer,
  type PrinterCategoryRole,
  type PrinterRole,
  type ResolvedPrinter,
  type SaveCategoryPrinterInput,
  type SaveCategoryRoleInput,
  type SavePrinterInput,
  type SearchPrinterResult,
  type TableQRPrintJob
} from "@/services/printer";
import { errorMessage } from "@/stores/store-utils";

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
  test: (data: BuildTestJobRequest) => Promise<void>;
  print: (job: PrintJob) => Promise<void>;
  printTableQr: (job: TableQRPrintJob) => Promise<void>;
  loadCategoryRoles: (loginUuid: string) => Promise<CategoryRole[]>;
  saveCategoryRole: (input: SaveCategoryRoleInput) => Promise<void>;
  loadPrinterCategoryRole: (loginUuid: string, printerUuid: string, lang?: string) => Promise<PrinterCategoryRole | null>;
  saveCategoryPrinter: (input: SaveCategoryPrinterInput) => Promise<void>;
  resolveByCategory: (loginUuid: string, categoryUuids: string[]) => Promise<ResolvedPrinter[]>;
  getDefaultCategoryByRole: (input: DefaultCategoryByRoleInput) => ReturnType<typeof getDefaultCategoryByRole>;
  loadPendingJobs: (printJobUuid: string, loginUuid: string) => Promise<PendingPrintJobData[]>;
  ack: (payload: AckPayload) => ReturnType<typeof ackPrintJob>;
  executeKitchen: (input: ExecuteKitchenPrintInput) => ReturnType<typeof executeKitchenPrintJobs>;
  reset: () => void;
}

export const usePrinterStore = create<PrinterState>((set) => ({
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
    set({ loading: true, error: null });
    try {
      const printers = await getPrinters(params);
      set({ printers, loading: false });
      return printers;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  loadPrintersForLocalAgent: async (params) => {
    set({ loading: true, error: null });

    const result = await resolvePrinterDeviceIdentity();
    const agent = result.ok ? result.agent : null;
    const agentId = textValue(agent?.agent_id);
    const deviceCode = textValue(agent?.device_code);

    if (!result.ok || !agentId || !deviceCode) {
      const error = result.ok ? "Printer device identity missing" : result.error;
      set({
        printers: [],
        agent,
        agentStatus: "offline",
        agentError: error,
        error,
        loading: false
      });
      return [];
    }

    set({ agent, agentStatus: "connected", agentError: null });

    try {
      const printers = await getPrinters({
        ...params,
        agent_id: agentId,
        device_code: deviceCode
      });
      set({ printers, loading: false });
      return printers;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  loadOptions: async (loginUuid, lang) => {
    const options = await getPrinterOptions(loginUuid, lang);
    set({ options });
    return options;
  },
  loadAgentFiles: async () => {
    set({ loadingAgentFiles: true, error: null });
    try {
      const agentFiles = await getAgentFiles();
      set({ agentFiles, loadingAgentFiles: false });
      return agentFiles;
    } catch (error) {
      set({ error: errorMessage(error), loadingAgentFiles: false });
      throw error;
    }
  },
  discover: async (mode = "usb") => {
    set({ searching: true, error: null });
    try {
      const result = await searchPrinters(mode);
      set({
        found: result.printers,
        agent: result.agent,
        agentStatus: result.agent ? "connected" : "unchecked",
        agentError: null,
        searching: false
      });
      return result.printers;
    } catch (error) {
      set({ error: errorMessage(error), agentStatus: "offline", agentError: errorMessage(error), searching: false });
      throw error;
    }
  },
  checkAgent: async (agentUrl) => {
    const result = await resolvePrinterDeviceIdentity(agentUrl);
    set({
      agent: result.ok ? result.agent ?? null : null,
      agentStatus: result.ok ? "connected" : "offline",
      agentError: result.ok ? null : result.error ?? null
    });
    return result.ok;
  },
  resolveDeviceIdentity: async (agentUrl) => {
    const result = await resolvePrinterDeviceIdentity(agentUrl);
    set({
      agent: result.ok ? result.agent ?? null : null,
      agentStatus: result.ok ? "connected" : "offline",
      agentError: result.ok ? null : result.error ?? null
    });
    if (!result.ok) throw new Error(result.error);
    return result.agent;
  },
  loadRoles: async (lang) => {
    const roles = await getPrinterRoles(lang);
    set({ roles });
    return roles;
  },
  save: async (input) => {
    set({ saving: true, error: null });
    try {
      const printer = await savePrinter(input);
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
      return printer;
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  remove: async (printConfigUuid) => {
    set({ saving: true, error: null });
    try {
      await deletePrinter(printConfigUuid);
      set((state) => ({
        printers: state.printers.filter((printer) => printer.print_config_uuid !== printConfigUuid),
        saving: false
      }));
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  toggleActive: async (printConfigUuid) => {
    set({ saving: true, error: null });
    try {
      await togglePrinterActive(printConfigUuid);
      set((state) => ({
        printers: state.printers.map((printer) =>
          printer.print_config_uuid === printConfigUuid ? { ...printer, is_active: !printer.is_active } : printer
        ),
        saving: false
      }));
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  buildTest: (data) => buildTestJob(data),
  test: async (input) => {
    set({ printing: true, error: null });
    try {
      const result = await buildTestJob(input);
      await printOps(result.data.job);
      set({ printing: false });
    } catch (error) {
      set({ error: errorMessage(error), printing: false });
      throw error;
    }
  },
  print: async (job) => {
    set({ printing: true, error: null });
    try {
      await printOps(job);
      set({ printing: false });
    } catch (error) {
      set({ error: errorMessage(error), printing: false });
      throw error;
    }
  },
  printTableQr: (job) => printTableQRJob(job),
  loadCategoryRoles: async (loginUuid) => {
    const categoryRoles = await getCategoryRoles(loginUuid);
    set({ categoryRoles });
    return categoryRoles;
  },
  saveCategoryRole: (input) => saveCategoryRole(input),
  loadPrinterCategoryRole: async (loginUuid, printerUuid, lang) => {
    const printerCategoryRole = await fetchPrinterCategoryRole(loginUuid, printerUuid, lang);
    set({ printerCategoryRole });
    return printerCategoryRole;
  },
  saveCategoryPrinter: (input) => saveCategoryPrinter(input),
  resolveByCategory: async (loginUuid, categoryUuids) => {
    const resolvedPrinters = await resolvePrintersByCategory(loginUuid, categoryUuids);
    set({ resolvedPrinters });
    return resolvedPrinters;
  },
  getDefaultCategoryByRole: (input) => getDefaultCategoryByRole(input),
  loadPendingJobs: async (printJobUuid, loginUuid) => {
    const pendingJobs = await getPendingPrintJobs(printJobUuid, loginUuid);
    set({ pendingJobs });
    return pendingJobs;
  },
  ack: (payload) => ackPrintJob(payload),
  executeKitchen: (input) => executeKitchenPrintJobs(input),
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
