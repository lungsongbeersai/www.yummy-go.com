import type { AgentInfo, Printer, PrinterReadinessStatus } from "@/services/printer";

export interface SavedPrinterDiagnostic {
  print_config_uuid: string;
  printer_name: string;
  interface_value: string;
  status: PrinterReadinessStatus;
}

export function localPrinterDiagnosticTargets(printers: Printer[], agent: AgentInfo | null) {
  if (!agent?.agent_id || !agent.device_code) return [];
  return printers.filter((printer) =>
    printer.is_active && printer.connect_type.toLowerCase() === "usb" &&
    /^(cups|win):[^\x00-\x1f\x7f]+$/i.test(printer.interface_value.trim()) &&
    printer.agent_id === agent.agent_id && printer.device_code === agent.device_code &&
    printer.is_local_device !== false,
  );
}

export function printerDiagnosticReasonKey(status: PrinterReadinessStatus) {
  const reasons: Record<string, string> = {
    printer_paused: "paused",
    printer_not_accepting_jobs: "notAccepting",
    printer_offline: "offline",
    printer_offline_reported: "offlineReported",
    printer_paper_out: "paperOut",
    printer_paper_out_reported: "paperOut",
    printer_paper_jam: "paperJam",
    printer_paper_jam_reported: "paperJam",
    printer_cover_open: "coverOpen",
    printer_cover_open_reported: "coverOpen",
    printer_manual_feed_required: "manualFeed",
    printer_error: "error",
    printer_error_reported: "error",
  };
  return `printer.diagnostics.${reasons[status.reason ?? ""] ?? "unknown"}`;
}
