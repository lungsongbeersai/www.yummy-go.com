import {
  clearPrinterMaintenanceQueue, getPrinterMaintenanceQueue, updatePrinterConnection,
  type ClearPrinterQueueInput, type PrinterConnectionUpdateResult, type PrinterMaintenanceQueue,
  type PrinterQueueClearResult, type UpdatePrinterConnectionInput,
} from "@/services/printer";
import { createSessionGuard } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("payload" in error) || !error.payload || typeof error.payload !== "object") return null;
  return "code" in error.payload && typeof error.payload.code === "string" ? error.payload.code : null;
}

export interface PrinterMaintenanceState {
  maintenancePrinterUuid: string | null;
  maintenanceQueue: PrinterMaintenanceQueue | null;
  maintenanceLoading: boolean;
  maintenanceSaving: boolean;
  maintenanceError: string | null;
  maintenanceErrorCode: string | null;
  maintenanceConnectionResult: PrinterConnectionUpdateResult | null;
  maintenanceClearResult: PrinterQueueClearResult | null;
  loadMaintenanceQueue: (printerUuid: string) => Promise<void>;
  updateMaintenanceConnection: (input: UpdatePrinterConnectionInput) => Promise<PrinterConnectionUpdateResult | null>;
  clearMaintenanceQueue: (input: ClearPrinterQueueInput) => Promise<PrinterQueueClearResult | null>;
  resetMaintenance: () => void;
}

export function createPrinterMaintenanceSlice(set: (patch: Partial<PrinterMaintenanceState>) => void, get: () => PrinterMaintenanceState): PrinterMaintenanceState {
  let generation = 0;
  let readGeneration = 0;
  const controllers = new Set<AbortController>();
  function scope(printerUuid: string) {
    const controller = new AbortController();
    controllers.add(controller);
    const session = createSessionGuard(), currentGeneration = generation;
    return { controller, current: () => session() && currentGeneration === generation && !controller.signal.aborted && get().maintenancePrinterUuid === printerUuid,
      done: () => controllers.delete(controller) };
  }
  function mutationAllowed(printerUuid: string, configurationVersion: string) {
    const state = get();
    return !state.maintenanceSaving && !state.maintenanceLoading && state.maintenancePrinterUuid === printerUuid &&
      state.maintenanceQueue?.configuration_version === configurationVersion;
  }
  function beginMutation() {
    readGeneration += 1;
    set({ maintenanceSaving: true, maintenanceLoading: false, maintenanceError: null, maintenanceErrorCode: null,
      maintenanceConnectionResult: null, maintenanceClearResult: null });
  }
  function mutationFailure(error: unknown) {
    // A lost write response may mean the mutation committed. Invalidate the
    // preview so a new user action first obtains the server's current state.
    set({ maintenanceSaving: false, maintenanceQueue: null, maintenanceError: errorMessage(error), maintenanceErrorCode: errorCode(error) });
  }
  return {
    maintenancePrinterUuid: null, maintenanceQueue: null, maintenanceLoading: false, maintenanceSaving: false,
    maintenanceError: null, maintenanceErrorCode: null, maintenanceConnectionResult: null, maintenanceClearResult: null,
    resetMaintenance: () => {
      generation += 1;
      readGeneration += 1;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      set({ maintenancePrinterUuid: null, maintenanceQueue: null, maintenanceLoading: false, maintenanceSaving: false,
        maintenanceError: null, maintenanceErrorCode: null, maintenanceConnectionResult: null, maintenanceClearResult: null });
    },
    loadMaintenanceQueue: async (printerUuid) => {
      if (get().maintenancePrinterUuid !== printerUuid) {
        get().resetMaintenance();
        set({ maintenancePrinterUuid: printerUuid });
      }
      if (get().maintenanceSaving) return;
      const request = scope(printerUuid), reading = ++readGeneration;
      set({ maintenanceLoading: true, maintenanceError: null, maintenanceErrorCode: null });
      try {
        const queue = await getPrinterMaintenanceQueue(printerUuid, { signal: request.controller.signal });
        if (!request.current() || reading !== readGeneration) return;
        set({ maintenanceQueue: queue, maintenanceLoading: false });
      } catch (error) {
        if (request.current() && reading === readGeneration) set({ maintenanceQueue: null, maintenanceLoading: false, maintenanceError: errorMessage(error), maintenanceErrorCode: errorCode(error) });
      } finally { request.done(); }
    },
    updateMaintenanceConnection: async (input) => {
      if (!mutationAllowed(input.print_config_uuid, input.configuration_version)) return null;
      const request = scope(input.print_config_uuid);
      beginMutation();
      try {
        const result = await updatePrinterConnection(input, { signal: request.controller.signal });
        if (!request.current()) return null;
        set({ maintenanceConnectionResult: result, maintenanceQueue: null, maintenanceSaving: false });
        return result;
      } catch (error) {
        if (request.current()) mutationFailure(error);
        return null;
      } finally { request.done(); }
    },
    clearMaintenanceQueue: async (input) => {
      if (!mutationAllowed(input.print_config_uuid, input.configuration_version) ||
          get().maintenanceQueue?.queue_version !== input.queue_version || !get().maintenanceQueue?.clearable_job_count) return null;
      const request = scope(input.print_config_uuid);
      beginMutation();
      try {
        const result = await clearPrinterMaintenanceQueue(input, { signal: request.controller.signal });
        if (!request.current()) return null;
        set({ maintenanceClearResult: result, maintenanceQueue: null, maintenanceSaving: false });
        return result;
      } catch (error) {
        if (request.current()) mutationFailure(error);
        return null;
      } finally { request.done(); }
    },
  };
}
