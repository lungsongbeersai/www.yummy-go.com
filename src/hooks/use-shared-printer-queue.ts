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
  type AgentInfo,
  type CheckPrinterAgentConnectionResult,
  type PendingPrintJobRef,
  type PendingPrintJobsParams,
} from "@/services/printer";
import { useAuthStore } from "@/stores/auth-store";
import { startSharedPrinterQueueRunner } from "@/hooks/shared-printer-queue-runner";

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
    print_mode: printerPrintModeForPlatform(agent.platform, nativeMobile),
    agent_ready: true,
    refs_only: true,
  };
}

export function isSharedPrintJobForLocalOwner(ref: PendingPrintJobRef, agent: AgentInfo) {
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

    const runner = startSharedPrinterQueueRunner({
      nativeMobile,
      isVisible: () => document.visibilityState !== "hidden",
      resolveOwner: async () => {
        const result = await resolvePrinterDeviceIdentity();
        return isSharedPrinterOwnerReady(result, nativeMobile) ? result.agent : null;
      },
      fetchPending: async (agent, signal) => {
        const pending = await getPendingPrintJobs(sharedPrinterOwnerPendingQuery(loginUuid, agent, nativeMobile), { signal });
        return pending.pendingJobRefs ?? [];
      },
      isLocalOwner: isSharedPrintJobForLocalOwner,
      execute: processRef,
      onExecutionError: (ref, error) => {
        console.error("[shared-printer] owner queue failed", {
          print_job_uuid: ref.print_job_uuid,
          error: error instanceof Error ? error.message : error,
        });
      },
      onPollError: (error) => {
        console.warn(
          "[shared-printer] pending poll failed:",
          error instanceof Error ? error.message : error,
        );
      },
    });

    function handleWake() {
      void runner.poll();
    }

    function handleQueued(payload: PrintJobQueuedPayload) {
      if (payload.remote_shared_print !== true) return;
      void runner.receive(payload);
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
      runner.stop();
      unsubscribe();
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("online", handleWake);
    };
  }, [user?.branch_uuid, user?.uuid]);
}
