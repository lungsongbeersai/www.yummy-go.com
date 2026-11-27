import type { Printer } from "@/services/printer";

export function printerMaintenanceEndpoint(ip: string, port: string): string | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)) return null;
  const [a, b] = parts.map(Number);
  if (!(a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))) return null;
  if (!/^[1-9]\d{0,4}$/.test(port.trim()) || Number(port.trim()) > 65535) return null;
  return `tcp://${parts.join(".")}:${Number(port.trim())}`;
}

export function parsePrinterMaintenanceEndpoint(value: string): { ip: string; port: string } | null {
  const match = /^tcp:\/\/([^:/?#\s]+):([1-9]\d{0,4})$/.exec(value);
  return match && printerMaintenanceEndpoint(match[1], match[2]) ? { ip: match[1], port: match[2] } : null;
}

export function supportsPrinterMaintenance(printer: Printer): boolean {
  return printer.connect_type === "tcp" && printer.print_mode !== "mobile_wifi" &&
    Boolean(printer.login_uuid_fk && printer.device_code && printer.agent_id) &&
    !/^(mobile|sunmi|capacitor)(?:[-_:]|$)/i.test(printer.agent_id ?? "") &&
    parsePrinterMaintenanceEndpoint(printer.interface_value) !== null;
}

export function printerMaintenanceProblemKey(code: string | null): string {
  if (/CONFLICT|STALE|CHANGED|MISMATCH/i.test(code ?? "")) return "printer.maintenance.conflict";
  if (/OWNER|DENIED|FORBIDDEN/i.test(code ?? "")) return "printer.maintenance.ownerRequired";
  if (/SETUP_REQUIRED|NOT_FOUND|UNSUPPORTED/i.test(code ?? "")) return "printer.maintenance.unavailable";
  return "printer.maintenance.failed";
}
