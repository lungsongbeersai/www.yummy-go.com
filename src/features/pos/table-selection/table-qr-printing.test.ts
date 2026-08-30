import { describe, expect, it, vi } from "vitest";
import {
  resolveTableQrPrinterContext,
  tableQrPrintOutcome,
} from "./table-qr-printing";

describe("table QR printing", () => {
  it("resolves the active device before creating a QR print queue", async () => {
    const resolveDeviceContext = vi.fn().mockResolvedValue({
      agent_id: "agent-1",
      device_code: "POS-1",
      print_mode: "mac_agent",
    });

    const context = await resolveTableQrPrinterContext({
      loginUuid: "login-1",
      resolveDeviceIdentity: vi.fn().mockResolvedValue({
        agent_id: "agent-1",
        device_code: "POS-1",
      }),
      resolveDeviceContext,
    });

    expect(resolveDeviceContext).toHaveBeenCalledWith({
      login_uuid_fk: "login-1",
      agent_id: "agent-1",
      device_code: "POS-1",
    });
    expect(context).toEqual({
      agent_id: "agent-1",
      device_code: "POS-1",
      print_mode: "mac_agent",
    });
  });

  it("keeps identity fields when printer context lookup is temporarily unavailable", async () => {
    await expect(resolveTableQrPrinterContext({
      loginUuid: "login-1",
      resolveDeviceIdentity: vi.fn().mockResolvedValue({
        agent_id: "mobile",
        device_code: "PHONE-WEB-1",
      }),
      resolveDeviceContext: vi.fn().mockRejectedValue(new Error("offline")),
    })).resolves.toEqual({
      agent_id: "mobile",
      device_code: "PHONE-WEB-1",
    });
  });

  it("does not report an empty or pending QR result as printed", () => {
    expect(tableQrPrintOutcome({ successCount: 0, failedCount: 0, pending: true })).toBe("pending");
    expect(tableQrPrintOutcome({ successCount: 0, failedCount: 0 })).toBe("fallback");
    expect(tableQrPrintOutcome({ successCount: 1, failedCount: 0 })).toBe("success");
  });
});
