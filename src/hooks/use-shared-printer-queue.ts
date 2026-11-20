"use client";

import { useEffect } from "react";
import { subscribePrintJobs, type PrintJobQueuedPayload } from "@/lib/socket";
import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import { printerPrintModeForPlatform } from "@/lib/printer-platform";
import {
  executeInvoicePrintJobs,
  executeKitchenPrintJobs,
  executeReportPrintJobs,
  getPendingPrintJobs,
  isBrowserPrinterAgentId,
  resolvePrinterDeviceIdentity,
  getSunmiBuiltinPrinterIdentity,
  registerSunmiNativePrinterOwner,
  type AgentInfo,
  type CheckPrinterAgentConnectionResult,
  type PendingPrintJobRef,
  type PendingPrintJobsParams,
} from "@/services/printer";
import { useAuthStore } from "@/stores/auth-store";
import { startSharedPrinterQueueRunner } from "@/hooks/shared-printer-queue-runner";
import { SUNMI_PRINTER_AGENT_ID, SUNMI_PRINT_MODE, canHostSunmiBuiltinPrinter } from "@/config/sunmi-printer";
import { createSessionGuard } from "@/stores/session-store-registry";

const DOCUMENT_PRINT_SOURCES = new Set([
  "qr_table",
  "print_invoice",
  "payment_receipt",
  "split_bill",
  "split_invoice",
  "split_receipt",
  "cancel_order_item",
]);

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

export function sharedPrinterOwnerPendingQuery(
  loginUuid: string,
  agent: AgentInfo,
  nativeMobile = false,
): PendingPrintJobsParams {
  return {
    print_job_uuid: "",
    login_uuid_fk: textValue(loginUuid),
    device_code: textValue(agent.device_code),
    agent_id: textValue(agent.agent_id),
    print_mode: agent.agent_id === SUNMI_PRINTER_AGENT_ID && agent.supports_sunmi_builtin === true
      ? SUNMI_PRINT_MODE
      : printerPrintModeForPlatform(agent.platform, nativeMobile),
    agent_ready: true,
    refs_only: true,
  };
}

export function isSharedPrintJobForLocalOwner(ref: PendingPrintJobRef, agent: AgentInfo) {
  if (agent.agent_id === SUNMI_PRINTER_AGENT_ID && (
    ref.agent_id !== SUNMI_PRINTER_AGENT_ID || ref.print_mode !== SUNMI_PRINT_MODE
  )) return false;
  return (
    ref.remote_shared_print === true &&
    textValue(ref.device_code) === textValue(agent.device_code) &&
    (!textValue(ref.agent_id) || textValue(ref.agent_id) === textValue(agent.agent_id))
  );
}

export function sharedPrintExecutionKind(
  ref: PendingPrintJobRef,
): "kitchen" | "invoice" | "report" {
  const source = textValue(ref.source);
  if (source === "report") return "report";
  if (DOCUMENT_PRINT_SOURCES.has(source)) return "invoice";
  // Missing/unknown sources keep the legacy kitchen behavior. This is safer
  // for order state because kitchen ACK requires completion confirmation.
  return "kitchen";
}

export function isSharedPrinterOwnerReady(
  result: CheckPrinterAgentConnectionResult,
  nativeMobile = false,
): result is Extract<CheckPrinterAgentConnectionResult, { ok: true }> {
  if (result.ok && result.agent.agent_id === SUNMI_PRINTER_AGENT_ID) {
    return nativeMobile && result.connected !== false && result.agent.supports_sunmi_builtin === true &&
      result.agent.sunmi_ready === true && result.agent.print_mode === SUNMI_PRINT_MODE && Boolean(textValue(result.agent.device_code));
  }
  // A cached desktop identity is useful for routing configuration, but it is
  // not proof that the Local Agent can currently receive a print job.
  return result.ok &&
    result.connected !== false &&
    (nativeMobile || !isBrowserPrinterAgentId(result.agent.agent_id));
}

export function useSharedPrinterQueue() {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const loginUuid = textValue(user?.uuid);
    const branchUuid = textValue(user?.branch_uuid);
    if (!loginUuid || !branchUuid) return;

    const nativeMobile = isCapacitorMobileApp();
    const isCurrentSession = createSessionGuard();
    const isCurrentBuiltinHost = () => {
      const current = useAuthStore.getState().user;
      return isCurrentSession() && current?.uuid === loginUuid && current.branch_uuid === branchUuid &&
        canHostSunmiBuiltinPrinter(current.status);
    };

    async function processRef(ref: PendingPrintJobRef, agent: AgentInfo) {
      const printJobUuid = textValue(ref.print_job_uuid);
      const input = {
        pending_query: {
          print_job_uuid: printJobUuid,
          login_uuid_fk: loginUuid,
          device_code: textValue(ref.device_code) || textValue(agent.device_code),
          agent_id: textValue(ref.agent_id) || textValue(agent.agent_id),
          print_mode: textValue(ref.print_mode) || undefined,
          agent_ready: true,
        },
      };
      const executionKind = sharedPrintExecutionKind(ref);
      const result = executionKind === "report"
        ? await executeReportPrintJobs(input)
        : executionKind === "invoice"
          ? await executeInvoicePrintJobs(input)
          : await executeKitchenPrintJobs(input);

      if (result.failedCount > 0) {
        console.error("[shared-printer] owner print failed", {
          print_job_uuid: printJobUuid,
          error: result.errorMessage,
        });
      }
    }

    const common = {
      nativeMobile,
      isVisible: () => document.visibilityState !== "hidden",
      fetchPending: async (agent: AgentInfo, signal: AbortSignal) => {
        const pending = await getPendingPrintJobs(sharedPrinterOwnerPendingQuery(loginUuid, agent, nativeMobile), { signal });
        return pending.pendingJobRefs ?? [];
      },
      isLocalOwner: isSharedPrintJobForLocalOwner,
      execute: processRef,
      onExecutionError: (ref: PendingPrintJobRef, error: unknown) => {
        console.error("[shared-printer] owner queue failed", {
          print_job_uuid: ref.print_job_uuid,
          error: error instanceof Error ? error.message : error,
        });
      },
      onPollError: (error: unknown) => {
        console.warn(
          "[shared-printer] pending poll failed:",
          error instanceof Error ? error.message : error,
        );
      },
    };
    const runners = [startSharedPrinterQueueRunner({
      ...common,
      resolveOwner: async (signal) => {
        const result = await resolvePrinterDeviceIdentity();
        if (!isSharedPrinterOwnerReady(result, nativeMobile)) return null;
        if (nativeMobile && isCurrentBuiltinHost()) {
          try {
            // TCP relay readiness belongs to the app's socket transport. A
            // paper-out built-in printer must not stop the kitchen IP queue.
            const host = await getSunmiBuiltinPrinterIdentity(false);
            if (host?.supports_tcp_relay && host.device_code === result.agent.device_code &&
              !signal.aborted && isCurrentBuiltinHost()) {
              await registerSunmiNativePrinterOwner(loginUuid, host, { signal });
            }
          } catch (error) {
            // LAN jobs can still run; the server expires Internet readiness
            // unless this native capability registration succeeds again.
            console.warn("[shared-printer] native TCP receiver registration failed", error instanceof Error ? error.message : error);
          }
        }
        return !signal.aborted && isCurrentSession() ? result.agent : null;
      },
    })];
    if (nativeMobile && canHostSunmiBuiltinPrinter(user?.status)) {
      // Keep the existing mobile/TCP identity and pending work intact. The
      // built-in printer is a second, SDK-attested receiver on the same device.
      runners.push(startSharedPrinterQueueRunner({
        ...common,
        resolveOwner: async (signal) => {
          if (signal.aborted || !isCurrentBuiltinHost()) return null;
          const agent = await getSunmiBuiltinPrinterIdentity(true);
          if (!agent || signal.aborted || !isCurrentBuiltinHost()) return null;
          await registerSunmiNativePrinterOwner(loginUuid, agent, { signal });
          return !signal.aborted && isCurrentBuiltinHost() ? agent : null;
        },
      }));
    }

    function handleWake() {
      for (const runner of runners) void runner.poll();
    }

    function handleQueued(payload: PrintJobQueuedPayload) {
      if (payload.remote_shared_print !== true) return;
      for (const runner of runners) void runner.receive(payload);
    }

    const unsubscribe = subscribePrintJobs(
      branchUuid,
      handleQueued,
      handleWake,
    );
    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener("online", handleWake);

    return () => {
      for (const runner of runners) runner.stop();
      unsubscribe();
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("online", handleWake);
    };
  }, [user?.branch_uuid, user?.uuid, user?.status]);
}
