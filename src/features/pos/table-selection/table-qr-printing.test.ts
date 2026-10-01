import { describe, expect, it, vi } from "vitest";
import {
  buildQrPrintDocument,
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

  it("never replaces the mobile requester with a Shared owner context", async () => {
    await expect(resolveTableQrPrinterContext({
      loginUuid: "login-1",
      resolveDeviceIdentity: vi.fn().mockResolvedValue({
        agent_id: "mobile",
        device_code: "android-native-1",
      }),
      resolveDeviceContext: vi.fn().mockResolvedValue({
        agent_id: "shared-agent",
        device_code: "SHARED-OWNER",
        print_mode: "windows_agent",
      }),
    })).resolves.toEqual({
      agent_id: "mobile",
      device_code: "android-native-1",
    });
  });

  it("does not report an empty or pending QR result as printed", () => {
    expect(tableQrPrintOutcome({ successCount: 0, failedCount: 0, pending: true })).toBe("pending");
    expect(tableQrPrintOutcome({ successCount: 0, failedCount: 0 })).toBe("error");
    expect(tableQrPrintOutcome({ successCount: 1, failedCount: 0 })).toBe("success");
  });

  it("builds the same escaped receipt document for browser and Android printing", () => {
    const browserDocument = buildQrPrintDocument({
      autoPrint: true,
      imageUrl: "data:image/svg+xml,<svg>&</svg>",
      layout: "receipt",
      title: "T<&\"'01",
    });
    const androidDocument = buildQrPrintDocument({
      autoPrint: false,
      imageUrl: "data:image/svg+xml,<svg>&</svg>",
      layout: "receipt",
      title: "T<&\"'01",
    });

    for (const document of [browserDocument, androidDocument]) {
      expect(document).toContain("@page { size: 57mm 90mm; margin: 0; }");
      expect(document).toContain("T&lt;&amp;&quot;&#39;01");
      expect(document).toContain("data:image/svg+xml,&lt;svg&gt;&amp;&lt;/svg&gt;");
    }
    expect(browserDocument).toContain("window.print()");
    expect(androidDocument).not.toContain("window.print()");
  });

  it("builds a full-page menu QR document", () => {
    const document = buildQrPrintDocument({
      autoPrint: false,
      imageUrl: "data:image/png;base64,qr",
      layout: "page",
      title: "Main branch",
    });

    expect(document).toContain("body { color: #111; text-align: center; padding: 16mm; }");
    expect(document).toContain("Main branch");
    expect(document).not.toContain("@page { size: 57mm 90mm; margin: 0; }");
  });
});
