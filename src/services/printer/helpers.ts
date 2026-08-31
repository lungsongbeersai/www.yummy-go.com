import { ServiceError } from "@/lib/api";
// Import from types.ts (not the printer.ts barrel) to avoid a circular import:
// printer.ts re-exports from this file, so importing back from printer.ts here
// would create a cycle.
import type {
  AckPayload,
  Printer,
  PrinterCategory,
  PrinterDeliveryState,
} from "@/services/printer/types";
import { stringArray } from "@/services/shared/validators";

// Shared across the printer/ submodules (config-api, agent-transport, print-jobs).
export const AGENT_SECRET = process.env.NEXT_PUBLIC_PRINTER_AGENT_SECRET ?? "";

// งานใบยาวต้องรอทั้ง render และส่งข้อมูลตามความเร็ว buffer ของเครื่องพิมพ์
// ใช้จำนวน ops คำนวณ timeout เฉพาะ printer transport โดยไม่แตะ timeout API อื่น
export function printerRequestTimeoutMs(
  jobs: Array<{ ops?: unknown[] } | null | undefined>
) {
  const opsTotal = jobs.reduce(
    (sum, job) => sum + (Array.isArray(job?.ops) ? job.ops.length : 0),
    0
  );

  // Agent อาจต้องรอคิวเครื่องเดิม รวมเวลา render ใบยาว และส่ง raster แบบหน่วง
  // ให้ buffer เครื่องพิมพ์ จึงต้องยาวกว่า timeout ฝั่ง relay ของ Agent เล็กน้อย
  // ไม่เช่นนั้น client จะรายงานล้มเหลวทั้งที่ Agent รับงานและกำลังพิมพ์ต่ออยู่
  return Math.min(600_000, Math.max(75_000, 45_000 + opsTotal * 150));
}

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

export function getPrinterDeliveryState(error: unknown): Exclude<PrinterDeliveryState, "printed"> {
  const record = objectValue(error);
  const response = objectValue(record?.response);
  const responseData = objectValue(response?.data);
  const responseHeaders = objectValue(response?.headers);
  const headerGetter = responseHeaders?.get;
  const deliveryHeader = typeof headerGetter === "function"
    ? headerGetter.call(responseHeaders, "x-printer-delivery-state")
    : responseHeaders?.["x-printer-delivery-state"];
  const explicit = textValue(
    responseData?.delivery_state ?? deliveryHeader ?? record?.delivery_state
  ).toLowerCase();

  if (explicit === "not_sent" || explicit === "unknown") return explicit;

  const code = textValue(record?.code).toUpperCase();
  const message = getPrinterErrorMessage(error).toUpperCase();
  const statusCode = Number(record?.statusCode ?? response?.status ?? 0);
  const definitelyNotSent =
    statusCode === 400 ||
    statusCode === 409 ||
    statusCode === 501 ||
    ["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND"].some(
      (token) => code === token || message.includes(token)
    );

  return definitelyNotSent ? "not_sent" : "unknown";
}

export function agentBase(defaultAgentUrl: string, agentUrl?: string) {
  return (agentUrl?.trim() || defaultAgentUrl).replace(/\/+$/, "");
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(value: unknown) {
  return value === undefined ? undefined : Boolean(value);
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
    kitchen_cut_mode: item.kitchen_cut_mode === "none" ? "none" : "per_ticket",
    cash_drawer_enabled: item.cash_drawer_enabled === undefined
      ? true
      : Boolean(item.cash_drawer_enabled),
    is_active: Boolean(item.is_active),
    is_active_label: activeLabel(item),
    created_at: item.created_at === undefined ? undefined : String(item.created_at),
    updated_at: item.updated_at === undefined ? undefined : String(item.updated_at),
    font_size: item.font_size === undefined ? undefined : Number(item.font_size),
    role_codes: stringArray(item.role_codes),
    categories: Array.isArray(item.categories) ? item.categories as PrinterCategory[] : [],
    cate_uuid_fk: stringArray(item.cate_uuid_fk),
    is_owner: optionalBoolean(item.is_owner),
    is_shared: optionalBoolean(item.is_shared),
    agent_online: optionalBoolean(item.agent_online),
    owner_device_code: item.owner_device_code === undefined ? undefined : String(item.owner_device_code),
    can_edit: optionalBoolean(item.can_edit),
    can_delete: optionalBoolean(item.can_delete)
  };
}

export { parseInterfaceValue, tcpInterfaceValue } from "@/config/printer-agent";

export function assertAgentOk(data: { ok?: boolean; error?: string; message?: string }, fallback: string) {
  if (data.ok === false) throw new ServiceError(data.error || data.message || fallback, 500);
}

export function failPayload(
  payload: AckPayload,
  reason: string,
  deliveryState?: Exclude<PrinterDeliveryState, "printed">,
  printConfigUuid?: string,
): AckPayload {
  return {
    ...payload,
    results: payload.results.map((item) =>
      item.status === "failed"
        ? {
          ...item,
          ...(!item.reason ? { reason } : {}),
          ...(deliveryState ? { delivery_state: deliveryState } : {}),
          ...(printConfigUuid ? { print_config_uuid: printConfigUuid } : {}),
        }
        : item
    )
  };
}
