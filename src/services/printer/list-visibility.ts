import type { AgentInfo, Printer } from "./types";
import { isLanSharedPrinter } from "@/lib/printer-list-mode";
export { isLanSharedPrinter } from "@/lib/printer-list-mode";

export interface PrinterListNetworkStatus {
  state: "local" | "unknown";
  reason: string;
}

export interface PrinterListNetworkContext {
  agent: AgentInfo | null;
  connected: boolean;
}

const PROBE_TIMEOUT_MS = 1800;
const PROBE_CONCURRENCY = 4;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function ownerIdentity(printer: Printer) {
  return {
    agentId: text(printer.agent_id),
    deviceCode: text(printer.owner_device_code) || text(printer.device_code),
  };
}

function ownerHealthUrl(printer: Printer): string | null {
  const value = text(printer.resolved_agent_url) ||
    text(printer.registered_agent_url) || text(printer.agent_url);
  // A saved peer URL is the only candidate. Never scan a subnet, resolve a
  // hostname, send a secret, or probe the printer's raw TCP endpoint.
  const match = value.match(/^https?:\/\/((?:\d{1,3}\.){3}\d{1,3})(?::(\d{1,5}))?\/?$/i);
  if (!match) return null;
  const octets = match[1].split(".").map(Number);
  if (octets.some((part, index) => part < 0 || part > 255 || String(part) !== match[1].split(".")[index])) return null;
  const privateAddress = octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
  if (!privateAddress) return null;
  if (match[2]) {
    const port = Number(match[2]);
    if (port < 1 || port > 65535 || port === 9100 || String(port) !== match[2]) return null;
  }
  return new URL("/health", value).href;
}

function unknown(reason: string): PrinterListNetworkStatus {
  return { state: "unknown", reason };
}

interface OwnerProbe {
  url: string;
  agentId: string;
  deviceCode: string;
  printerUuids: string[];
}

async function probeOwner(probe: OwnerProbe, signal?: AbortSignal): Promise<PrinterListNetworkStatus> {
  if (signal?.aborted) return unknown("check_aborted");
  const controller = new AbortController();
  const startedAt = Date.now();
  let timedOut = false;
  let rejectCancelled!: (error: Error) => void;
  const cancelled = new Promise<never>((_resolve, reject) => { rejectCancelled = reject; });
  const abort = () => {
    rejectCancelled(new Error("Printer visibility check aborted"));
    controller.abort();
  };
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    rejectCancelled(new Error("Printer visibility check timed out"));
    controller.abort();
  }, PROBE_TIMEOUT_MS);
  const read = async (): Promise<PrinterListNetworkStatus> => {
    if (signal?.aborted || controller.signal.aborted) return unknown("check_aborted");
    // /health exposes public Agent identity. This read must never borrow the
    // authenticated Backend client or change the terminal's cached identity.
    const response = await fetch(probe.url, {
      method: "GET",
      credentials: "omit",
      mode: "cors",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok || response.redirected) return unknown("owner_unconfirmed");
    const payload = record(await response.json());
    const elapsed = Date.now() - startedAt;
    if (signal?.aborted || controller.signal.aborted || elapsed < 0 || elapsed >= PROBE_TIMEOUT_MS) {
      return unknown(signal?.aborted ? "check_aborted" : "check_timed_out");
    }
    const agent = record(payload?.agent);
    if (payload?.ok !== true || !text(agent?.agent_id) || !text(agent?.device_code)) {
      return unknown("owner_unconfirmed");
    }
    if (text(agent?.agent_id) !== probe.agentId || text(agent?.device_code) !== probe.deviceCode) {
      return unknown("owner_identity_mismatch");
    }
    return { state: "local", reason: "owner_verified" };
  };
  try {
    return await Promise.race([read(), cancelled]);
  } catch {
    return unknown(signal?.aborted ? "check_aborted" : timedOut ? "check_timed_out" : "owner_unreachable");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/** Presentation-only proof; it does not filter config storage or route print jobs. */
export async function resolvePrinterListVisibility(
  printers: Printer[],
  context: PrinterListNetworkContext,
  signal?: AbortSignal,
): Promise<Record<string, PrinterListNetworkStatus>> {
  const statuses = new Map<string, PrinterListNetworkStatus>();
  const probes = new Map<string, OwnerProbe>();
  for (const printer of printers) {
    const uuid = printer.print_config_uuid;
    if (!isLanSharedPrinter(printer)) {
      statuses.set(uuid, { state: "local", reason: printer.access_mode === "INTERNET" ? "internet" : "device" });
      continue;
    }
    const { agentId, deviceCode } = ownerIdentity(printer);
    if (!agentId || !deviceCode) {
      statuses.set(uuid, unknown("owner_identity_missing"));
      continue;
    }
    if (context.connected && context.agent &&
        text(context.agent.agent_id) === agentId && text(context.agent.device_code) === deviceCode) {
      // This confirms the current owner device, not physical printer readiness.
      statuses.set(uuid, { state: "local", reason: "owner_device" });
      continue;
    }
    const url = ownerHealthUrl(printer);
    if (!url) {
      statuses.set(uuid, unknown("owner_address_unavailable"));
      continue;
    }
    const key = JSON.stringify([url, agentId, deviceCode]);
    const existing = probes.get(key);
    if (existing) existing.printerUuids.push(uuid);
    else probes.set(key, { url, agentId, deviceCode, printerUuids: [uuid] });
  }
  const work = [...probes.values()];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, work.length) }, async () => {
    while (next < work.length) {
      const probe = work[next++];
      const status = await probeOwner(probe, signal);
      for (const uuid of probe.printerUuids) statuses.set(uuid, status);
    }
  }));
  return Object.fromEntries(statuses);
}
