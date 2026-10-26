import axios, { isAxiosError } from "axios";
import { AGENT_URL } from "@/config/printer-agent";
import { ServiceError } from "@/lib/api";
import { AGENT_SECRET, agentBase } from "@/services/printer/helpers";
import type { PrinterReadinessInput, PrinterReadinessStatus } from "@/services/printer/types";

const READ_TIMEOUT_MS = 5500;
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

// Only the already connected Agent URL is supplied by the store. A printer's
// advertised owner URL is never used to send browser credentials or probe a
// different cashier's USB queue with the same name.
export async function getPrinterReadiness(
  input: PrinterReadinessInput,
  options: { agentUrl?: string; signal?: AbortSignal } = {},
): Promise<PrinterReadinessStatus> {
  const interfaceValue = input.interface_value.trim();
  const match = interfaceValue.match(/^(cups|win):([^\x00-\x1f\x7f]+)$/i);
  if (!match || !input.expected_agent_id || !input.expected_device_code) {
    return { state: "not_applicable", reason: "printer_queue_not_applicable" };
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ServiceError("Printer status check timed out.", 503));
      controller.abort();
    }, READ_TIMEOUT_MS);
  });
  try {
    const response = await Promise.race([
      axios.get<unknown>(`${agentBase(AGENT_URL, options.agentUrl)}/printer/readiness`, {
        params: { ...input, interface_value: interfaceValue },
        headers: { "x-agent-secret": AGENT_SECRET },
        timeout: 5000,
        signal: controller.signal,
      }),
      expired,
    ]);
    if (controller.signal.aborted || performance.now() - started >= READ_TIMEOUT_MS) throw new ServiceError("Printer status check expired.", 503);
    const payload = record(response.data);
    const agent = record(payload?.agent);
    const status = record(payload?.data);
    if (payload?.ok !== true || agent?.agent_id !== input.expected_agent_id || agent?.device_code !== input.expected_device_code) {
      throw new ServiceError("Local Printer Agent changed. Refresh the connection.", 409);
    }
    if (!status || !["ready", "blocked", "unknown", "not_applicable"].includes(String(status.state))) {
      throw new ServiceError("Printer status could not be confirmed.", 503);
    }
    if ((status.state === "ready" || status.state === "blocked") &&
        (typeof status.printer_name !== "string" || status.kind !== match[1].toLowerCase())) {
      throw new ServiceError("Printer queue identity could not be confirmed.", 409);
    }
    if (typeof status.printer_name === "string" && status.printer_name.toLowerCase() !== match[2].trim().toLowerCase()) {
      throw new ServiceError("Printer queue changed. Refresh the printer list.", 409);
    }
    return {
      state: status.state as PrinterReadinessStatus["state"],
      ...(typeof status.reason === "string" ? { reason: status.reason } : {}),
      ...(status.kind === "cups" || status.kind === "win" ? { kind: status.kind } : {}),
      ...(typeof status.printer_name === "string" ? { printer_name: status.printer_name } : {}),
      ...(Array.isArray(status.reasons) ? { reasons: status.reasons.filter((value): value is string => typeof value === "string") } : {}),
      ...(typeof status.queued_job_count === "number" && Number.isSafeInteger(status.queued_job_count) && status.queued_job_count >= 0 ? { queued_job_count: status.queued_job_count } : {}),
    };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return { state: "unknown", reason: "printer_readiness_unsupported" };
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
