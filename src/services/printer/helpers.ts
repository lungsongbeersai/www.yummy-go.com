import { ServiceError } from "@/lib/api";
// Import from types.ts (not the printer.ts barrel) to avoid a circular import:
// printer.ts re-exports from this file, so importing back from printer.ts here
// would create a cycle.
import type { AckPayload, Printer, PrinterCategory } from "@/services/printer/types";
import { stringArray } from "@/services/shared/validators";

// Shared across the printer/ submodules (config-api, agent-transport, print-jobs).
export const AGENT_SECRET = process.env.NEXT_PUBLIC_PRINTER_AGENT_SECRET ?? "";

export function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function getPrinterErrorMessage(error: unknown) {
  const response = objectValue(objectValue(error)?.response);
  const responseData = response?.data;
  const payload = objectValue(responseData);
  const agentMessage =
    nonEmptyString(payload?.error) ||
    nonEmptyString(payload?.message) ||
    nonEmptyString(responseData);

  if (agentMessage) return agentMessage;
  if (error instanceof Error) return error.message;
  return nonEmptyString(error) || "Unknown printer error";
}

export function agentBase(defaultAgentUrl: string, agentUrl?: string) {
  return (agentUrl?.trim() || defaultAgentUrl).replace(/\/+$/, "");
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function activeLabel(item: Record<string, unknown>) {
  const keys = [
    "is_active_label",
    "is_active_text",
    "is_active_name",
    "active_label",
    "active_text",
    "active_name",
    "print_config_active_text",
    "print_config_status_text",
    "print_config_status_name",
    "printer_status_text",
    "printer_status_name",
    "status_text",
    "status_name"
  ];

  for (const key of keys) {
    const label = stringValue(item[key]);
    if (label) return label;
  }

  return undefined;
}

export function mapPrinter(item: Record<string, unknown>): Printer {
  return {
    ...item,
    print_config_id: item.print_config_id === undefined ? undefined : String(item.print_config_id),
    print_config_uuid: String(item.print_config_uuid ?? ""),
    branch_uuid_fk: item.branch_uuid_fk === undefined ? undefined : String(item.branch_uuid_fk),
    login_uuid_fk: item.login_uuid_fk === undefined ? undefined : String(item.login_uuid_fk),
    device_code: item.device_code === undefined ? undefined : String(item.device_code),
    printer_name: String(item.printer_name ?? item.display_name ?? ""),
    printer_type: item.printer_type === undefined ? undefined : String(item.printer_type),
    connect_type: String(item.connect_type ?? ""),
    interface_value: String(item.interface_value ?? ""),
    agent_url: item.agent_url === undefined ? undefined : String(item.agent_url),
    agent_id: item.agent_id === undefined ? undefined : String(item.agent_id),
    agent_name: item.agent_name === undefined ? undefined : String(item.agent_name),
    print_mode: item.print_mode === undefined ? undefined : String(item.print_mode),
    paper_width_mm: Number(item.paper_width_mm ?? 80),
    is_active: Boolean(item.is_active),
    is_active_label: activeLabel(item),
    created_at: item.created_at === undefined ? undefined : String(item.created_at),
    updated_at: item.updated_at === undefined ? undefined : String(item.updated_at),
    font_size: item.font_size === undefined ? undefined : Number(item.font_size),
    role_codes: stringArray(item.role_codes),
    categories: Array.isArray(item.categories) ? item.categories as PrinterCategory[] : [],
    cate_uuid_fk: stringArray(item.cate_uuid_fk)
  };
}

export { parseInterfaceValue, tcpInterfaceValue } from "@/config/printer-agent";

export function assertAgentOk(data: { ok?: boolean; error?: string; message?: string }, fallback: string) {
  if (data.ok === false) throw new ServiceError(data.error || data.message || fallback, 500);
}

export function failPayload(payload: AckPayload, reason: string): AckPayload {
  return {
    ...payload,
    results: payload.results.map((item) =>
      item.status === "failed" && !item.reason ? { ...item, reason } : item
    )
  };
}
