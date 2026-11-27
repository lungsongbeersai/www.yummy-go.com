import axios from "axios";
import { apiRequest, ServiceError, type RequestOptions } from "@/lib/api";
import { AGENT_URL } from "@/config/printer-agent";
import { AGENT_SECRET, agentBase } from "@/services/printer/helpers";
import { resolvePrinterDeviceIdentity } from "@/services/printer/agent-transport";
import type { ApiDataResponse } from "@/services/shared/types";
import type { AgentInfo, ClearPrinterQueueInput, CreatePrinterSupportCommand, PrinterConnectionUpdateResult, PrinterMaintenanceQueue, PrinterMaintenanceQueueJob, PrinterQueueClearResult, PrinterSupportAction, PrinterSupportClaim, PrinterSupportCommand, PrinterSupportCommandStatus, PrinterSupportExecution, PrinterSupportResult, PrinterSupportSummary, UpdatePrinterConnectionInput } from "@/services/printer/types";

const actions: PrinterSupportAction[] = ["diagnose", "refresh_neighbor", "pin_neighbor", "remove_pin"];
const statuses: PrinterSupportCommandStatus[] = ["queued", "running", "succeeded", "failed", "unknown", "expired"];
const uuidPattern = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function identity(value: string) {
  if (!uuidPattern.test(value)) throw new ServiceError("Invalid printer support identifier", 400);
  return value;
}
function invalid(): never { throw new ServiceError("Invalid printer support response", 502); }
function version(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 256 || !/^[!-~]+$/.test(value)) invalid();
  return value;
}
function inputVersion(value: string) {
  try { return version(value); }
  catch { throw new ServiceError("Invalid printer configuration version", 400); }
}
function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) invalid();
  return Number(value);
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) invalid();
  return value;
}
function privateTcpEndpoint(value: string) {
  const match = /^tcp:\/\/([^:/?#\s]+):([1-9][0-9]{0,4})$/.exec(value);
  const octets = match?.[1].split(".").map(Number);
  if (!match || !octets || octets.length !== 4 || octets.some((n, index) => !Number.isInteger(n) || n < 0 || n > 255 || String(n) !== match[1].split(".")[index]) ||
      Number(match[2]) > 65535 || !(octets[0] === 10 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168)) {
    throw new ServiceError("A private IPv4 TCP printer endpoint is required", 400);
  }
  return value;
}

async function managementHeaders(options: RequestOptions, required = false) {
  const headers = { ...options.headers };
  for (const key of Object.keys(headers)) if (["x-device-code", "x-agent-id"].includes(key.toLowerCase())) delete headers[key];
  if (options.signal?.aborted) throw new ServiceError("Printer maintenance request cancelled", 499);
  let agent: AgentInfo | null = null;
  try {
    const current = await resolvePrinterDeviceIdentity();
    if (current.ok && current.connected !== false) agent = current.agent;
  } catch { /* Offsite managers may still read the Backend's scoped summary. */ }
  if (options.signal?.aborted) throw new ServiceError("Printer maintenance request cancelled", 499);
  if (agent?.device_code && agent.agent_id) {
    headers["x-device-code"] = agent.device_code;
    headers["x-agent-id"] = agent.agent_id;
  } else if (required) {
    throw new ServiceError("Use the printer owner's connected device to change this printer", 403, undefined, { code: "PRINTER_SUPPORT_OWNER_DEVICE_REQUIRED" });
  }
  return headers;
}

export function parsePrinterSupportResult(value: unknown): PrinterSupportResult {
  const row = object(value);
  if (!row || typeof row.code !== "string" || typeof row.checked_at !== "string" ||
      !Number.isFinite(Date.parse(row.checked_at)) || typeof row.platform !== "string" ||
      typeof row.admin !== "boolean" || typeof row.changed !== "boolean" || typeof row.rollback_available !== "boolean") invalid();
  const out: PrinterSupportResult = { code: row.code, checked_at: row.checked_at, platform: row.platform,
    admin: row.admin, changed: row.changed, rollback_available: row.rollback_available };
  if (row.tcp !== undefined) {
    const tcp = object(row.tcp);
    if (!tcp || !["open", "refused", "timeout", "error"].includes(String(tcp.state)) || tcp.bytes_sent !== 0) invalid();
    out.tcp = { state: tcp.state as NonNullable<PrinterSupportResult["tcp"]>["state"], bytes_sent: 0,
      ...(typeof tcp.code === "string" ? { code: tcp.code } : {}) };
  }
  const neighbor = (value: unknown) => {
    const n = object(value);
    if (!n || !(n.mac === null || typeof n.mac === "string") || !(n.state === null || typeof n.state === "string")) invalid();
    return { mac: n.mac, state: n.state };
  };
  if (row.neighbor !== undefined) out.neighbor = neighbor(row.neighbor);
  if (row.before !== undefined) { const before = object(row.before); if (!before) invalid(); out.before = { neighbor: neighbor(before.neighbor) }; }
  if (row.network !== undefined) {
    const n = object(row.network);
    if (!n || !(n.interface_index === null || Number.isSafeInteger(n.interface_index)) || typeof n.local_ipv4 !== "string" || !Number.isInteger(n.prefix_length)) invalid();
    out.network = { interface_index: n.interface_index === null ? null : Number(n.interface_index), local_ipv4: n.local_ipv4, prefix_length: Number(n.prefix_length) };
  }
  return out;
}

export function parsePrinterSupportCommand(value: unknown): PrinterSupportCommand {
  const row = object(value);
  if (!row || typeof row.command_uuid !== "string" || !uuidPattern.test(row.command_uuid) ||
      typeof row.print_config_uuid !== "string" || !uuidPattern.test(row.print_config_uuid) ||
      !actions.includes(row.action as PrinterSupportAction) || !statuses.includes(row.status as PrinterSupportCommandStatus) ||
      typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)) ||
      typeof row.expires_at !== "string" || !Number.isFinite(Date.parse(row.expires_at)) ||
      !(row.finished_at === null || typeof row.finished_at === "string") ||
      !(row.error_code === null || typeof row.error_code === "string")) invalid();
  return { command_uuid: row.command_uuid, print_config_uuid: row.print_config_uuid,
    action: row.action as PrinterSupportAction, status: row.status as PrinterSupportCommandStatus,
    created_at: row.created_at, expires_at: row.expires_at, finished_at: row.finished_at,
    error_code: row.error_code, result: row.result === null ? null : parsePrinterSupportResult(row.result) };
}

export async function getPrinterSupportSummary(printerUuid: string, options: RequestOptions = {}): Promise<PrinterSupportSummary> {
  identity(printerUuid);
  const headers = await managementHeaders(options);
  const response = await apiRequest<ApiDataResponse<unknown>>("get", "/api/v1/printer/support/summary", {
    ...options, headers, params: { print_config_uuid: printerUuid }, timeout: 10000,
  });
  const row = object(response.data), printer = object(row?.printer), recent = object(row?.recent);
  if (!row || !printer || printer.print_config_uuid !== printerUuid || typeof printer.interface_value !== "string" ||
      typeof printer.printer_name !== "string" || !recent || !Array.isArray(row.commands)) invalid();
  for (const key of ["success", "pending", "failed", "unknown"]) if (!Number.isSafeInteger(recent[key]) || Number(recent[key]) < 0) invalid();
  const commands = row.commands.map(parsePrinterSupportCommand);
  if (commands.some((command) => command.print_config_uuid !== printerUuid)) invalid();
  const capabilities = row.capabilities === undefined ? null : object(row.capabilities);
  if (row.capabilities !== undefined && (!capabilities || typeof capabilities.connection_update !== "boolean" || typeof capabilities.queue_management !== "boolean")) invalid();
  return { printer: { print_config_uuid: printerUuid, printer_name: printer.printer_name, interface_value: printer.interface_value,
    device_code: typeof printer.device_code === "string" ? printer.device_code : undefined,
    agent_id: typeof printer.agent_id === "string" ? printer.agent_id : undefined, agent_online: printer.agent_online === true,
    ...(printer.configuration_version === undefined ? {} : { configuration_version: version(printer.configuration_version) }) },
    recent: { success: Number(recent.success), pending: Number(recent.pending), failed: Number(recent.failed), unknown: Number(recent.unknown),
      last_error: typeof recent.last_error === "string" ? recent.last_error : null,
      last_error_at: typeof recent.last_error_at === "string" ? recent.last_error_at : null }, commands,
    capabilities: { connection_update: capabilities?.connection_update === true, queue_management: capabilities?.queue_management === true } };
}

export function parsePrinterMaintenanceQueue(value: unknown, printerUuid: string): PrinterMaintenanceQueue {
  const row = object(value);
  if (!row || row.print_config_uuid !== printerUuid || !Array.isArray(row.clearable_jobs)) invalid();
  const seen = new Set<string>();
  const clearable_jobs: PrinterMaintenanceQueueJob[] = row.clearable_jobs.map((value) => {
    const job = object(value);
    if (!job || typeof job.print_job_uuid !== "string" || !uuidPattern.test(job.print_job_uuid) || seen.has(job.print_job_uuid) ||
        typeof job.source !== "string" || !job.source || !["pending", "partial", "failed"].includes(String(job.job_status))) invalid();
    seen.add(job.print_job_uuid);
    return { print_job_uuid: job.print_job_uuid, source: job.source,
      job_status: job.job_status as PrinterMaintenanceQueueJob["job_status"], item_count: count(job.item_count),
      created_at: timestamp(job.created_at), updated_at: timestamp(job.updated_at) };
  });
  const clearable_job_count = count(row.clearable_job_count);
  if (clearable_job_count < clearable_jobs.length) invalid();
  return { print_config_uuid: printerUuid, configuration_version: version(row.configuration_version), queue_version: version(row.queue_version),
    clearable_jobs, clearable_job_count, blocked_job_count: count(row.blocked_job_count), pending_job_count: count(row.pending_job_count) };
}

export async function getPrinterMaintenanceQueue(printerUuid: string, options: RequestOptions = {}): Promise<PrinterMaintenanceQueue> {
  identity(printerUuid);
  const headers = await managementHeaders(options);
  const response = await apiRequest<ApiDataResponse<unknown>>("get", "/api/v1/printer/support/queue", {
    ...options, headers, params: { print_config_uuid: printerUuid }, timeout: 10000,
  });
  return parsePrinterMaintenanceQueue(response.data, printerUuid);
}

export async function updatePrinterConnection(input: UpdatePrinterConnectionInput, options: RequestOptions = {}): Promise<PrinterConnectionUpdateResult> {
  const data = { print_config_uuid: identity(input.print_config_uuid), configuration_version: inputVersion(input.configuration_version), interface_value: privateTcpEndpoint(input.interface_value) };
  const headers = await managementHeaders(options, true);
  const response = await apiRequest<ApiDataResponse<unknown>>("post", "/api/v1/printer/support/connection", { ...options, headers, data, timeout: 10000 });
  const row = object(response.data), printer = object(row?.printer);
  if (!row || typeof row.changed !== "boolean" || !printer || printer.print_config_uuid !== data.print_config_uuid || printer.interface_value !== data.interface_value) invalid();
  return { printer: { print_config_uuid: data.print_config_uuid, interface_value: data.interface_value, configuration_version: version(printer.configuration_version) }, changed: row.changed };
}

export async function clearPrinterMaintenanceQueue(input: ClearPrinterQueueInput, options: RequestOptions = {}): Promise<PrinterQueueClearResult> {
  const data = { request_uuid: identity(input.request_uuid), print_config_uuid: identity(input.print_config_uuid),
    configuration_version: inputVersion(input.configuration_version), queue_version: inputVersion(input.queue_version) };
  const headers = await managementHeaders(options, true);
  const response = await apiRequest<ApiDataResponse<unknown>>("post", "/api/v1/printer/support/queue/clear", { ...options, headers, data, timeout: 10000 });
  const row = object(response.data);
  if (!row || row.request_uuid !== data.request_uuid) invalid();
  return { request_uuid: data.request_uuid, cleared_jobs: count(row.cleared_jobs), cleared_items: count(row.cleared_items) };
}

export async function createPrinterSupportCommand(input: CreatePrinterSupportCommand, options: RequestOptions = {}) {
  identity(input.print_config_uuid); identity(input.request_uuid);
  if (!actions.includes(input.action)) throw new ServiceError("Invalid printer support action", 400);
  if (input.evidence_command_uuid) identity(input.evidence_command_uuid);
  const response = await apiRequest<ApiDataResponse<unknown>>("post", "/api/v1/printer/support/commands", { ...options, data: input, timeout: 10000 });
  const command = parsePrinterSupportCommand(response.data);
  if (command.print_config_uuid !== input.print_config_uuid || command.action !== input.action) invalid();
  return command;
}

export async function getPrinterSupportCommand(commandUuid: string, options: RequestOptions = {}) {
  const response = await apiRequest<ApiDataResponse<unknown>>("get", `/api/v1/printer/support/commands/${identity(commandUuid)}`, { ...options, timeout: 10000 });
  const command = parsePrinterSupportCommand(response.data);
  if (command.command_uuid !== commandUuid) invalid();
  return command;
}

export async function claimPrinterSupportCommand(agent: AgentInfo, signal: AbortSignal): Promise<PrinterSupportClaim> {
  const response = await apiRequest<ApiDataResponse<unknown>>("post", "/api/v1/printer/support/claim", {
    data: { device_code: agent.device_code, agent_id: agent.agent_id }, signal, timeout: 10000,
  });
  const row = object(response.data);
  if (!row) invalid();
  if (row.command === null) return { command: null };
  const command = parsePrinterSupportCommand(row.command);
  if (typeof row.execution_token !== "string" || !row.execution_token || command.status !== "running") invalid();
  return { command, execution_token: row.execution_token };
}

export async function executePrinterSupportCommand(claim: PrinterSupportClaim, agent: AgentInfo, signal: AbortSignal): Promise<PrinterSupportExecution> {
  if (!claim.command || !claim.execution_token) return { status: "failed", error_code: "SUPPORT_INVALID_CLAIM" };
  try {
    // The Agent authorizes this opaque job directly with Backend. Never lend
    // the browser JWT or allow a form-supplied host, URL or command to execute.
    const response = await axios.post<unknown>(`${agentBase(AGENT_URL)}/printer/support/execute`, {
      command_uuid: claim.command.command_uuid, execution_token: claim.execution_token,
      expected_agent_id: agent.agent_id, expected_device_code: agent.device_code,
    }, { headers: { "x-agent-secret": AGENT_SECRET }, signal, timeout: 90000, validateStatus: () => true });
    const row = object(response.data), receiver = object(row?.agent);
    if (!row || receiver?.agent_id !== agent.agent_id || receiver.device_code !== agent.device_code) invalid();
    const result = row.data ? parsePrinterSupportResult(row.data) : undefined;
    const code = typeof row.code === "string" ? row.code : result?.code ?? "";
    if (/UNKNOWN|UNCERTAIN|ROLLBACK_FAILED/i.test(code) || /UNKNOWN|UNCERTAIN|ROLLBACK_FAILED/i.test(result?.code ?? "")) {
      return { status: "unknown", ...(result ? { result } : {}), error_code: code || "SUPPORT_EXECUTION_UNCERTAIN" };
    }
    if (/ADMIN_REQUIRED|UNSUPPORTED|DENIED|FAILED|MISMATCH|STALE|CONFLICT|INVALID/i.test(code) ||
        /ADMIN_REQUIRED|UNSUPPORTED|DENIED|FAILED|MISMATCH|STALE|CONFLICT|INVALID/i.test(result?.code ?? "")) {
      return { status: "failed", ...(result ? { result } : {}), error_code: code || result?.code };
    }
    if (row.ok === true && result && ["NETWORK_DIAGNOSED", "NEIGHBOR_REFRESHED", "NEIGHBOR_PINNED", "NEIGHBOR_PIN_REMOVED", "NEIGHBOR_ALREADY_PINNED"].includes(result.code)) return { status: "succeeded", result };
    if (row.ok === false && typeof row.code === "string") return { status: "failed", ...(result ? { result } : {}), error_code: row.code };
  } catch {
    // A lost POST response cannot prove whether Windows already changed its
    // neighbor cache. Record uncertainty once; never retry the OS action.
  }
  return { status: "unknown", error_code: "SUPPORT_EXECUTION_UNCERTAIN" };
}

export async function acknowledgePrinterSupportCommand(claim: PrinterSupportClaim, execution: PrinterSupportExecution, signal: AbortSignal) {
  if (!claim.command || !claim.execution_token) throw new ServiceError("Invalid printer support claim", 400);
  return apiRequest<ApiDataResponse<unknown>>("post", "/api/v1/printer/support/result", { signal, timeout: 10000, data: {
    command_uuid: claim.command.command_uuid, execution_token: claim.execution_token, ...execution,
  } });
}
