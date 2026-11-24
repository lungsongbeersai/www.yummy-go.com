import {
  acknowledgePrinterSupportCommand, claimPrinterSupportCommand, createPrinterSupportCommand,
  executePrinterSupportCommand, getPrinterSupportCommand, getPrinterSupportSummary, resolvePrinterDeviceIdentity,
  type CreatePrinterSupportCommand, type PrinterSupportCommand, type PrinterSupportSummary,
} from "@/services/printer";
import { startPrinterSupportRunner } from "@/hooks/printer-support-runner";
import { createSessionGuard } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

function supportErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("payload" in error) || !error.payload || typeof error.payload !== "object") return null;
  return "code" in error.payload && typeof error.payload.code === "string" ? error.payload.code : null;
}

export interface PrinterSupportState {
  supportPrinterUuid: string | null;
  supportSummary: PrinterSupportSummary | null;
  supportCommand: PrinterSupportCommand | null;
  supportLoading: boolean;
  supportSending: boolean;
  supportError: string | null;
  supportErrorCode: string | null;
  loadPrinterSupport: (printerUuid: string) => Promise<void>;
  requestPrinterSupport: (input: CreatePrinterSupportCommand) => Promise<PrinterSupportCommand | null>;
  checkPrinterSupportCommand: () => Promise<void>;
  clearPrinterSupport: () => void;
  startPrinterSupportBridge: () => ReturnType<typeof startPrinterSupportRunner>;
}

export function createPrinterSupportSlice(set: (patch: Partial<PrinterSupportState>) => void, get: () => PrinterSupportState): PrinterSupportState {
  let generation = 0;
  let summaryGeneration = 0;
  const controllers = new Set<AbortController>();
  function readScope(printerUuid: string) {
    const controller = new AbortController(); controllers.add(controller);
    const session = createSessionGuard(), currentGeneration = generation;
    return { controller, current: () => session() && currentGeneration === generation && !controller.signal.aborted &&
      get().supportPrinterUuid === printerUuid, done: () => controllers.delete(controller) };
  }
  return {
    supportPrinterUuid: null, supportSummary: null, supportCommand: null,
    supportLoading: false, supportSending: false, supportError: null, supportErrorCode: null,
    clearPrinterSupport: () => {
      generation += 1; summaryGeneration += 1;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      set({ supportPrinterUuid: null, supportSummary: null, supportCommand: null, supportLoading: false, supportSending: false, supportError: null, supportErrorCode: null });
    },
    loadPrinterSupport: async (printerUuid) => {
      if (get().supportPrinterUuid !== printerUuid) {
        get().clearPrinterSupport();
        set({ supportPrinterUuid: printerUuid });
      }
      const scope = readScope(printerUuid), readGeneration = ++summaryGeneration;
      set({ supportLoading: true, supportError: null, supportErrorCode: null });
      try {
        const summary = await getPrinterSupportSummary(printerUuid, { signal: scope.controller.signal });
        if (!scope.current() || summaryGeneration !== readGeneration) return;
        const newest = [...summary.commands].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
        const existing = get().supportCommand;
        set({ supportSummary: summary, supportLoading: false,
          supportCommand: existing && (!newest || Date.parse(existing.created_at) > Date.parse(newest.created_at)) ? existing : newest });
      } catch (error) {
        if (scope.current() && summaryGeneration === readGeneration) set({ supportLoading: false, supportError: errorMessage(error), supportErrorCode: supportErrorCode(error) });
      } finally { scope.done(); }
    },
    requestPrinterSupport: async (input) => {
      if (get().supportSending || ["queued", "running"].includes(get().supportCommand?.status ?? "") || get().supportPrinterUuid !== input.print_config_uuid || !get().supportSummary) return null;
      const scope = readScope(input.print_config_uuid);
      summaryGeneration += 1;
      set({ supportSending: true, supportLoading: false, supportError: null, supportErrorCode: null });
      try {
        const command = await createPrinterSupportCommand(input, { signal: scope.controller.signal });
        if (!scope.current()) return null;
        const summary = get().supportSummary;
        set({ supportSending: false, supportCommand: command, supportSummary: summary ? {
          ...summary, commands: [command, ...summary.commands.filter((row) => row.command_uuid !== command.command_uuid)],
        } : null });
        return command;
      } catch (error) {
        if (scope.current()) set({ supportSending: false, supportError: errorMessage(error), supportErrorCode: supportErrorCode(error) });
        return null;
      } finally { scope.done(); }
    },
    checkPrinterSupportCommand: async () => {
      const command = get().supportCommand, printerUuid = get().supportPrinterUuid;
      if (!command || !printerUuid) return;
      const scope = readScope(printerUuid);
      try {
        const next = await getPrinterSupportCommand(command.command_uuid, { signal: scope.controller.signal });
        if (!scope.current() || get().supportCommand?.command_uuid !== command.command_uuid) return;
        const summary = get().supportSummary;
        set({ supportCommand: next, supportError: null, supportErrorCode: null, supportSummary: summary ? {
          ...summary, commands: [next, ...summary.commands.filter((row) => row.command_uuid !== next.command_uuid)],
        } : null });
      } catch (error) { if (scope.current()) set({ supportError: errorMessage(error), supportErrorCode: supportErrorCode(error) }); }
      finally { scope.done(); }
    },
    startPrinterSupportBridge: () => {
      const current = createSessionGuard();
      return startPrinterSupportRunner({
        isCurrent: current,
        resolveOwner: async (signal) => {
          const result = await resolvePrinterDeviceIdentity();
          return current() && !signal.aborted && result.ok && result.connected !== false ? result.agent : null;
        },
        claim: claimPrinterSupportCommand, execute: executePrinterSupportCommand,
        acknowledge: acknowledgePrinterSupportCommand,
        onError: (error) => console.warn("[printer-support] receiver failed", errorMessage(error)),
      });
    },
  };
}
