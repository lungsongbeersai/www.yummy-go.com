import { describe, expect, it } from "vitest";
import type { PrinterSupportCommand } from "@/services/printer";
import { freshPrinterSupportDiagnosis, normalizeVerifiedPrinterMac, printerSupportChangeKey, printerSupportProblemKey, printerSupportRepairAvailable, printerSupportTransportReady } from "./printer-support-utils";

const now = Date.parse("2026-11-23T08:00:00Z");
const command: PrinterSupportCommand = {
  command_uuid: "11111111-1111-4111-8111-111111111111", print_config_uuid: "22222222-2222-4222-8222-222222222222",
  action: "diagnose", status: "succeeded", created_at: new Date(now - 1000).toISOString(), expires_at: new Date(now + 120000).toISOString(),
  finished_at: new Date(now).toISOString(), error_code: null,
  result: { code: "NETWORK_DIAGNOSED", checked_at: new Date(now).toISOString(), platform: "win32", admin: true,
    changed: false, rollback_available: false, tcp: { state: "open", bytes_sent: 0 },
    network: { interface_index: 4, local_ipv4: "192.168.100.207", prefix_length: 24 } },
};

describe("printer troubleshooting decisions", () => {
  it("accepts a complete unicast MAC without inventing one from the network result", () => {
    expect(normalizeVerifiedPrinterMac("00:61:25:80:0a:11")).toBe("00-61-25-80-0A-11");
    for (const value of ["", "0011", "00-00-00-00-00-00", "FF-FF-FF-FF-FF-FF", "01-61-25-80-0A-11", "00-11-22-33-44-55;whoami"]) {
      expect(normalizeVerifiedPrinterMac(value)).toBeNull();
    }
  });
  it("requires a succeeded recent diagnosis and rejects clock-skewed or expired evidence", () => {
    expect(freshPrinterSupportDiagnosis([command], now)).toBe(command);
    expect(freshPrinterSupportDiagnosis([command], now + 300001)).toBeNull();
    expect(freshPrinterSupportDiagnosis([command], now - 1)).toBeNull();
    expect(freshPrinterSupportDiagnosis([{ ...command, status: "failed" }], now)).toBeNull();
    expect(freshPrinterSupportDiagnosis([{ ...command, action: "pin_neighbor" }], now)).toBeNull();
  });
  it("never turns a completed refusal, uncertain change or admin failure into printer ready", () => {
    expect(printerSupportTransportReady(command)).toBe(true);
    expect(printerSupportTransportReady({ ...command, status: "unknown" })).toBe(false);
    expect(printerSupportTransportReady({ ...command, result: { ...command.result!, tcp: { state: "refused", bytes_sent: 0 } } })).toBe(false);
    for (const code of ["SUPPORT_ADMIN_REQUIRED", "SUPPORT_EXECUTION_UNKNOWN", "ARBITRARY_SUCCESS"]) {
      expect(printerSupportTransportReady({ ...command, result: { ...command.result!, code } })).toBe(false);
    }
  });
  it("requires a new diagnosis after every repair attempt, including an uncertain mutation", () => {
    const repair: PrinterSupportCommand = { ...command, command_uuid: "33333333-3333-4333-8333-333333333333", action: "pin_neighbor", status: "unknown", created_at: new Date(now + 1000).toISOString(), finished_at: new Date(now + 2000).toISOString(), result: null };
    expect(freshPrinterSupportDiagnosis([command, repair], now + 3000)).toBeNull();
    const fresh = { ...command, command_uuid: "44444444-4444-4444-8444-444444444444", created_at: new Date(now + 2500).toISOString(), result: { ...command.result!, checked_at: new Date(now + 2800).toISOString() } };
    expect(freshPrinterSupportDiagnosis([command, repair, fresh], now + 3000)).toBe(fresh);
  });
  it("allows a Windows repair only with confirmed administrator and interface details", () => {
    expect(printerSupportRepairAvailable(command.result)).toBe(true);
    expect(printerSupportRepairAvailable({ ...command.result!, admin: false })).toBe(false);
    expect(printerSupportRepairAvailable({ ...command.result!, platform: "darwin", network: { ...command.result!.network!, interface_index: null } })).toBe(false);
  });
  it("does not promise no change when an operation or rollback is uncertain", () => {
    expect(printerSupportChangeKey(command)).toBe("printer.support.unchanged");
    expect(printerSupportChangeKey({ ...command, result: { ...command.result!, changed: true } })).toBe("printer.support.changed");
    expect(printerSupportChangeKey({ ...command, status: "unknown" })).toBe("printer.support.changeUnconfirmed");
    for (const code of ["SUPPORT_EXECUTION_UNKNOWN", "SUPPORT_EXECUTION_UNCERTAIN", "SUPPORT_ROLLBACK_FAILED"]) {
      expect(printerSupportChangeKey({ ...command, result: { ...command.result!, changed: false, code } })).toBe("printer.support.changeUnconfirmed");
    }
  });
  it("maps evidence changes, ownership and setup failures to actionable copy", () => {
    for (const code of ["SUPPORT_NEIGHBOR_CHANGED", "PRINTER_SUPPORT_TARGET_CHANGED", "DIAGNOSIS_REQUIRED", "SUPPORT_NETWORK_AMBIGUOUS", "SUPPORT_NETWORK_REQUIRED"]) {
      expect(printerSupportProblemKey(code)).toBe("printer.support.recheckRequired");
    }
    expect(printerSupportProblemKey("OWNER_REQUIRED")).toBe("printer.support.ownerRequired");
    expect(printerSupportProblemKey("SUPPORT_PIN_NOT_OWNED")).toBe("printer.support.pinNotOwned");
    expect(printerSupportProblemKey("PRINTER_SUPPORT_SETUP_REQUIRED")).toBe("printer.support.setupRequired");
  });
});
