"use client";

import { useEffect, useRef } from "react";
import { subscribePrintJobs, type PrintJobQueuedPayload } from "@/lib/socket";
import {
  executeKitchenPrintJobs,
  getPendingPrintJobs,
  resolvePrinterDeviceIdentity,
  type AgentInfo,
  type PendingPrintJobRef,
} from "@/services/printer";
import { useAuthStore } from "@/stores/auth-store";

const POLL_INTERVAL_MS = 2500;
const IDENTITY_REFRESH_MS = 10000;

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

export function isSharedPrintJobForLocalOwner(ref: PendingPrintJobRef, agent: AgentInfo) {
  return (
    ref.remote_shared_print === true &&
    textValue(ref.device_code) === textValue(agent.device_code) &&
    (!textValue(ref.agent_id) || textValue(ref.agent_id) === textValue(agent.agent_id))
  );
}

export function useSharedPrinterQueue() {
  const user = useAuthStore((state) => state.user);
  const offlineSession = useAuthStore((state) => state.offlineSession);
  const runningRef = useRef(false);
  const inFlightRef = useRef(new Set<string>());
  const identityRef = useRef<{ agent: AgentInfo; checkedAt: number } | null>(null);

  useEffect(() => {
    const loginUuid = textValue(user?.uuid);
    const branchUuid = textValue(user?.branch_uuid);
    if (!loginUuid || !branchUuid || offlineSession) return;

    let cancelled = false;

    async function localAgent() {
      const cached = identityRef.current;
      if (cached && Date.now() - cached.checkedAt < IDENTITY_REFRESH_MS) {
        return cached.agent;
      }

      const result = await resolvePrinterDeviceIdentity();
      if (!result.ok) return null;
      identityRef.current = { agent: result.agent, checkedAt: Date.now() };
      return result.agent;
    }

    async function processRef(ref: PendingPrintJobRef, agent: AgentInfo) {
      const printJobUuid = textValue(ref.print_job_uuid);
      if (!printJobUuid || inFlightRef.current.has(printJobUuid)) return;
      inFlightRef.current.add(printJobUuid);

      try {
        const result = await executeKitchenPrintJobs({
          pending_query: {
            print_job_uuid: printJobUuid,
            login_uuid_fk: loginUuid,
            device_code: textValue(ref.device_code) || textValue(agent.device_code),
            agent_id: textValue(ref.agent_id) || textValue(agent.agent_id),
            print_mode: textValue(ref.print_mode) || undefined,
          },
        });

        if (result.failedCount > 0) {
          console.error("[shared-printer] owner print failed", {
            print_job_uuid: printJobUuid,
            error: result.errorMessage,
          });
        }
      } catch (error) {
        console.error("[shared-printer] owner queue failed", {
          print_job_uuid: printJobUuid,
          error: error instanceof Error ? error.message : error,
        });
      } finally {
        inFlightRef.current.delete(printJobUuid);
      }
    }

    async function poll() {
      if (cancelled || runningRef.current) return;
      runningRef.current = true;

      try {
        const agent = await localAgent();
        if (!agent || cancelled) return;

        const pending = await getPendingPrintJobs({
          print_job_uuid: "",
          login_uuid_fk: loginUuid,
          device_code: textValue(agent.device_code),
          agent_id: textValue(agent.agent_id),
        });

        for (const ref of (pending.pendingJobRefs ?? []).filter((item) => isSharedPrintJobForLocalOwner(item, agent))) {
          if (cancelled) return;
          await processRef(ref, agent);
        }
      } catch (error) {
        console.warn(
          "[shared-printer] pending poll failed:",
          error instanceof Error ? error.message : error,
        );
      } finally {
        runningRef.current = false;
      }
    }

    function handleQueued(payload: PrintJobQueuedPayload) {
      if (payload.remote_shared_print !== true) return;
      void localAgent().then((agent) => {
        if (!agent || cancelled || !isSharedPrintJobForLocalOwner(payload, agent)) return;
        return processRef(payload, agent);
      });
    }

    const unsubscribe = subscribePrintJobs(branchUuid, handleQueued);
    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    void poll();

    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(interval);
      runningRef.current = false;
      inFlightRef.current.clear();
    };
  }, [offlineSession, user?.branch_uuid, user?.uuid]);
}
