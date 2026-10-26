import { describe, expect, it } from "vitest";
import type { AgentInfo, Printer } from "@/services/printer";
import { localPrinterDiagnosticTargets, printerDiagnosticReasonKey } from "@/stores/printer-diagnostics";

const agent: AgentInfo = { agent_id: "local", agent_name: "Cashier", device_code: "MAC1" };
const printer: Printer = {
  print_config_uuid: "receipt", printer_name: "Receipt", agent_id: "local", device_code: "MAC1",
  interface_value: "cups:Receipt", connect_type: "usb", paper_width_mm: 80, is_active: true, role_codes: ["INVOICE"], cate_uuid_fk: [],
};

describe("saved local printer diagnostics", () => {
  it("checks only active USB queues owned by the full connected device identity", () => {
    const rows = [printer, { ...printer, print_config_uuid: "remote", agent_id: "remote" },
      { ...printer, print_config_uuid: "other-device", device_code: "MAC2" },
      { ...printer, print_config_uuid: "inactive", is_active: false },
      { ...printer, print_config_uuid: "lan", connect_type: "tcp", interface_value: "tcp://192.168.1.7:9100" },
      { ...printer, print_config_uuid: "remote-mark", is_local_device: false }];
    expect(localPrinterDiagnosticTargets(rows, agent)).toEqual([printer]);
    expect(localPrinterDiagnosticTargets(rows, null)).toEqual([]);
    expect(localPrinterDiagnosticTargets(rows, { ...agent, device_code: undefined })).toEqual([]);
  });

  it("maps advisory offline state without promising the device is ready", () => {
    expect(printerDiagnosticReasonKey({ state: "unknown", reason: "printer_offline_reported" })).toBe("printer.diagnostics.offlineReported");
    expect(printerDiagnosticReasonKey({ state: "blocked", reason: "printer_paused" })).toBe("printer.diagnostics.paused");
    expect(printerDiagnosticReasonKey({ state: "unknown" })).toBe("printer.diagnostics.unknown");
  });
});
