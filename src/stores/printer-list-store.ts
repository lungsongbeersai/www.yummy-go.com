"use client";

import { create } from "zustand";
import {
  getPrinterManagementCatalog,
  resolvePrinterListVisibility,
  type FetchPrintersParams,
  type Printer,
  type PrinterListNetworkContext,
  type PrinterListNetworkStatus,
} from "@/services/printer";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";
import { printerListScopeKey } from "@/lib/printer-list-mode";

interface PrinterListContext extends PrinterListNetworkContext {
  scopeKey?: string;
}

interface PrinterListState {
  catalog: Printer[];
  networkVisibilityByPrinter: Record<string, PrinterListNetworkStatus>;
  loading: boolean;
  checkingNetwork: boolean;
  error: string | null;
  scopeKey: string;
  load: (params: FetchPrintersParams, context: PrinterListContext) => Promise<void>;
  invalidateNetwork: () => void;
  reset: () => void;
}

const initialState = {
  catalog: [] as Printer[],
  networkVisibilityByPrinter: {} as Record<string, PrinterListNetworkStatus>,
  loading: false,
  checkingNetwork: false,
  error: null as string | null,
  scopeKey: "",
};

let requestVersion = 0;
let networkController: AbortController | null = null;

function cancelNetworkCheck() {
  networkController?.abort();
  networkController = null;
}

// The management page owns this catalog. The operational printer store and its
// routing/test transports must never receive a filtered or expanded copy of it.
export const usePrinterListStore = create<PrinterListState>((set, get) => ({
  ...initialState,
  load: async (params, context) => {
    const version = ++requestVersion;
    const isCurrentSession = createSessionGuard();
    cancelNetworkCheck();
    const scopeKey = printerListScopeKey(params.login_uuid_fk, params.device_code || "", context.scopeKey || "");
    set({
      ...(get().scopeKey !== scopeKey ? initialState : {}),
      scopeKey,
      loading: true,
      error: null,
      // A focus/network refresh must not lend the previous Wi-Fi's proof to
      // the new connection while fresh identity checks are still pending.
      networkVisibilityByPrinter: {},
      checkingNetwork: false,
    });
    try {
      const catalog = await getPrinterManagementCatalog(params);
      if (version !== requestVersion || !isCurrentSession()) return;
      const controller = new AbortController();
      networkController = controller;
      set({ catalog, loading: false, checkingNetwork: true });
      const networkVisibilityByPrinter = await resolvePrinterListVisibility(catalog, context, controller.signal);
      if (version === requestVersion && isCurrentSession() && !controller.signal.aborted) {
        set({ networkVisibilityByPrinter, checkingNetwork: false });
      }
    } catch (error) {
      if (version !== requestVersion || !isCurrentSession()) return;
      set({ ...initialState, scopeKey, error: errorMessage(error) });
      throw error;
    }
  },
  invalidateNetwork: () => {
    requestVersion += 1;
    cancelNetworkCheck();
    set({ networkVisibilityByPrinter: {}, checkingNetwork: false, loading: false });
  },
  reset: () => {
    requestVersion += 1;
    cancelNetworkCheck();
    set(initialState);
  },
}));

registerSessionStoreReset("printer-list", () => usePrinterListStore.getState().reset());
