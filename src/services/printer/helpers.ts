import { ServiceError } from "@/lib/api";
import type { AckPayload, Printer, PrinterCategory } from "@/services/printer";
import { stringArray } from "@/services/shared/validators";

export const getPrinterErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown printer error";

export function agentBase(defaultAgentUrl: string, agentUrl?: string) {
  return (agentUrl?.trim() || defaultAgentUrl).replace(/\/+$/, "");
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
    paper_width_mm: Number(item.paper_width_mm ?? 80),
    is_active: Boolean(item.is_active),
    created_at: item.created_at === undefined ? undefined : String(item.created_at),
    updated_at: item.updated_at === undefined ? undefined : String(item.updated_at),
    font_size: item.font_size === undefined ? undefined : Number(item.font_size),
    role_codes: stringArray(item.role_codes),
    categories: Array.isArray(item.categories) ? item.categories as PrinterCategory[] : [],
    cate_uuid_fk: stringArray(item.cate_uuid_fk)
  };
}

export function parseInterfaceValue(interfaceValue: string) {
  if (interfaceValue.startsWith("tcp://")) {
    const [ip, port] = interfaceValue.replace("tcp://", "").split(":");
    return { mode: "network" as const, ip, port: Number(port || 9100) };
  }
  return { mode: "usb" as const, systemPrinterName: interfaceValue.replace(/^cups:|^win:/, "") };
}

export const getRoleColor = () => "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200";

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
