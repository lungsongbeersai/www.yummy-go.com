import { parseInterfaceValue, AGENT_URL } from "@/config/printer-agent";
import type { AgentInfo, Printer, PrinterMappingType } from "@/services/printer";
import type { Category } from "@/services/category";
import type { Zone } from "@/services/zone";
import { cn } from "@/lib/utils";

export type ConnectType = "usb" | "tcp";

export interface CheckboxOption {
  label: string;
  value: string;
  assignedTo?: string[];
}

// สไตล์เดียวกับ choiceCardClass ในฟอร์มสินค้า — ให้แถวที่ติ๊กแล้วเด่นขึ้นมาทันที ไม่ต้องเพ่งดูแค่ checkbox เล็กๆ
export function optionRowClass(active: boolean) {
  return cn(
    "cursor-pointer rounded-md border p-3 transition",
    active
      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
      : "border-border hover:border-primary/30 hover:bg-muted/30",
  );
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

// จำกัดให้พิมพ์ได้เฉพาะตัวเลขกับจุด และเติม "." อัตโนมัติหลังครบ 3 หลักในแต่ละ octet
// (สูงสุด 4 octet) — เทียบความยาวกับ previousValue เพื่อไม่เติมจุดซ้ำตอนกด backspace
export function formatIpInput(rawValue: string, previousValue: string) {
  const isDeleting = rawValue.length < previousValue.length;
  const cleaned = rawValue.replace(/[^0-9.]/g, "");

  const groups: string[] = [""];
  for (const char of cleaned) {
    const last = groups.length - 1;
    if (char === ".") {
      if (groups.length < 4 && groups[last] !== "") groups.push("");
      continue;
    }
    if (groups[last].length < 3) {
      groups[last] += char;
    } else if (groups.length < 4) {
      groups.push(char);
    }
  }

  const lastGroup = groups[groups.length - 1];
  const shouldAutoDot =
    !isDeleting && groups.length < 4 && lastGroup.length === 3;

  return groups.join(".") + (shouldAutoDot ? "." : "");
}

export function categoryLabel(category: Category, language: string) {
  const english = language.startsWith("en");
  const primary = english ? category.cate_name_eng : category.cate_name_la;
  const fallback = english ? category.cate_name_la : category.cate_name_eng;
  return primary || fallback || category.cate_name || category.cate_uuid;
}

export function zoneLabel(zone: Zone, language: string) {
  const english = language.startsWith("en");
  const primary = english ? zone.zone_name_eng : zone.zone_name_la;
  const fallback = english ? zone.zone_name_la : zone.zone_name_eng;
  return primary || fallback || zone.zone_name || zone.zone_uuid;
}

// เอาไว้เตือนตอนเลือก role/category ว่า "ตอนนี้ผูกอยู่กับเครื่องพิมพ์ไหนแล้วบ้าง" (ไม่รวมเครื่องที่กำลังแก้ไขอยู่)
// เพราะ role/category ผูกได้หลายเครื่องพร้อมกัน ผู้ใช้จึงต้องเห็นก่อนว่าเลือกซ้ำแล้วจะมีผลกับเครื่องอื่นด้วย
export function assignedPrinterNamesByValue(
  printers: Printer[],
  excludePrintConfigUuid: string,
  values: (printer: Printer) => string[],
) {
  const map = new Map<string, string[]>();
  printers.forEach((printer) => {
    if (printer.print_config_uuid === excludePrintConfigUuid) return;
    const name = printer.printer_name;
    if (!name) return;
    values(printer).forEach((value) => {
      if (!value) return;
      const names = map.get(value) ?? [];
      if (!names.includes(name)) names.push(name);
      map.set(value, names);
    });
  });
  return map;
}

// เครื่องพิมพ์เก่าก่อน backend เพิ่ม mapping_type จะไม่มีฟิลด์นี้มา — ถือว่าเป็น CATEGORY
// (พฤติกรรมเดิมก่อนมีโซน) ไม่ใช่ปล่อยว่าง ไม่งั้นแก้ไขเครื่องพิมพ์เก่าจะเห็นหมวดหมู่ที่เคยตั้งไว้หายไป
export function mappingTypeOf(printer: Printer | null): PrinterMappingType {
  return printer?.mapping_type ?? "CATEGORY";
}

// cate_uuid_fk มีความหมายทั้งสอง mapping_type แล้ว — ZONE ก็บังคับเลือกหมวดหมู่คู่กับโซนด้วย
// (backend contract ใหม่) จึงอ่านได้ตรงๆ ไม่ต้องกรองตาม mapping_type อีกต่อไป
export function categoryUuids(printer: Printer | null) {
  if (!printer) return [];
  if (printer.cate_uuid_fk.length) return printer.cate_uuid_fk;
  return (
    printer.categories?.map((category) => category.cate_uuid).filter(Boolean) ??
    []
  );
}

export function zoneUuids(printer: Printer | null) {
  if (!printer || mappingTypeOf(printer) !== "ZONE") return [];
  return printer.zone_uuid_fk ?? [];
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
    mappingType: mappingTypeOf(printer),
    selectedCategories: categoryUuids(printer),
    selectedZones: zoneUuids(printer),
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
