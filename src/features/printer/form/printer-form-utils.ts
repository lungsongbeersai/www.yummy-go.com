import { parseInterfaceValue, AGENT_URL } from "@/config/printer-agent";
import type { AgentInfo, Printer } from "@/services/printer";
import type { Category } from "@/services/category";

export type ConnectType = "usb" | "tcp";

export interface CheckboxOption {
  label: string;
  value: string;
}

export function safeId(prefix: string, value: string) {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function toggleAllValues(
  values: string[],
  options: CheckboxOption[],
  checked: boolean,
) {
  const optionValues = options.map((option) => option.value);
  if (checked) {
    const selected = new Set(values);
    return [
      ...values,
      ...optionValues.filter((value) => !selected.has(value)),
    ];
  }

  const optionSet = new Set(optionValues);
  return values.filter((value) => !optionSet.has(value));
}

export function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export function categoryLabel(category: Category, language: string) {
  const english = language.startsWith("en");
  const primary = english ? category.cate_name_eng : category.cate_name_la;
  const fallback = english ? category.cate_name_la : category.cate_name_eng;
  return primary || fallback || category.cate_name || category.cate_uuid;
}

export function categoryUuids(printer: Printer | null) {
  if (!printer) return [];
  if (printer.cate_uuid_fk.length) return printer.cate_uuid_fk;
  return (
    printer.categories?.map((category) => category.cate_uuid).filter(Boolean) ??
    []
  );
}

// ค่าฟอร์มที่คำนวณจากเครื่องพิมพ์ที่กำลังแก้ไข (null = โหมดเพิ่มใหม่)
// แยกออกมาเพื่อใช้ซ้ำได้ทั้งตอน seed useState ครั้งแรกและตอนรีเซ็ตระหว่าง render
export function printerFormValues(printer: Printer | null) {
  const parsed = parseInterfaceValue(printer?.interface_value ?? "");
  const connectType: ConnectType = printer
    ? printer.connect_type === "usb"
      ? "usb"
      : "tcp"
    : "tcp";

  return {
    connectType,
    displayName: printer?.printer_name ?? "",
    interfaceValue:
      connectType === "usb" ? (printer?.interface_value ?? "") : "",
    ip: connectType === "tcp" ? (parsed.ip ?? "") : "",
    port: String(connectType === "tcp" ? (parsed.port ?? 9100) : 9100),
    paperWidth: String(printer?.paper_width_mm ?? 80),
    selectedRoles: printer?.role_codes ?? [],
    selectedCategories: categoryUuids(printer),
    selectedDevice: "",
    agentUrl: textValue(printer?.agent_url) || AGENT_URL,
    agentId: printer?.agent_id ?? "",
    agentName: printer?.agent_name ?? "",
    deviceCode: printer?.device_code ?? "",
  };
}

// printer-store เป็น store ระดับโมดูล ข้อมูลจากหน้า list จึงค้างอยู่ตอนเข้าหน้าฟอร์ม
// ทำให้ editing/agent มีค่าตั้งแต่ render แรก — เดิมมี effect สองตัวทำงานต่อกันหลัง mount
// จึงรวมลำดับเดิม (เติมจากเรคคอร์ดก่อน แล้วค่อยเติมช่อง agent ที่ยังว่าง) ไว้ที่นี่
export function initialPrinterFormValues(
  printer: Printer | null,
  agent: AgentInfo | null,
  isEditing: boolean,
) {
  const values = printerFormValues(printer);
  if (!agent || isEditing) return values;

  return {
    ...values,
    agentUrl: values.agentUrl || AGENT_URL,
    agentId: values.agentId || textValue(agent.agent_id),
    agentName: values.agentName || textValue(agent.agent_name),
    deviceCode: values.deviceCode || textValue(agent.device_code),
  };
}
