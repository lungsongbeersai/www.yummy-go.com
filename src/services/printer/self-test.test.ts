import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrinterSelfTestInput } from "@/services/printer/types";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  getLocalAgentInfo: vi.fn(),
  isCapacitorMobileApp: vi.fn(),
  printMobilePrinterSelfTestOverTcp: vi.fn(),
  completeMobilePrinterSelfTest: vi.fn(),
}));

vi.mock("axios", () => ({ default: { post: mocks.post } }));
vi.mock("@/lib/api", () => ({
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500) {
      super(message);
      this.name = "ServiceError";
    }
  },
}));
vi.mock("@/lib/capacitor-platform", () => ({
  isCapacitorMobileApp: mocks.isCapacitorMobileApp,
}));
vi.mock("@/services/printer/agent-transport", () => ({
  getLocalAgentInfo: mocks.getLocalAgentInfo,
}));
vi.mock("@/services/printer/mobile-tcp", () => ({
  printMobilePrinterSelfTestOverTcp: mocks.printMobilePrinterSelfTestOverTcp,
  completeMobilePrinterSelfTest: mocks.completeMobilePrinterSelfTest,
}));

import { AGENT_URL } from "@/config/printer-agent";
import { completePrinterSelfTest, printPrinterSelfTest } from "@/services/printer/self-test";

const tcpInput: PrinterSelfTestInput = {
  connect_type: "tcp",
  interface_value: "tcp://192.168.1.20:9100",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isCapacitorMobileApp.mockReturnValue(false);
  mocks.getLocalAgentInfo.mockResolvedValue({
    agent_id: "local-agent",
    device_code: "local-device",
    agent_name: "Local terminal",
  });
  mocks.post.mockResolvedValue({
    data: { ok: true, status: "command_sent", result: { bytes: 7 } },
  });
});

describe("printer self-test", () => {
  it("sends an unsaved printer's current interface with the live local identity", async () => {
    const inputWithSavedIdentity = {
      connect_type: "usb" as const,
      interface_value: "cups:Receipt Printer",
      agent_id: "remote-saved-agent",
      device_code: "remote-saved-device",
      agent_url: "http://remote-saved-agent:7777",
    };

    await expect(printPrinterSelfTest(inputWithSavedIdentity)).resolves.toEqual({
      ok: true,
      status: "command_sent",
    });

    expect(mocks.getLocalAgentInfo).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      `${AGENT_URL.replace(/\/+$/, "")}/printer/self-test`,
      {
        agent_id: "local-agent",
        device_code: "local-device",
        interface_value: "cups:Receipt Printer",
      },
      { headers: { "x-agent-secret": expect.any(String) }, timeout: 45000 },
    );
    expect(mocks.printMobilePrinterSelfTestOverTcp).not.toHaveBeenCalled();
  });

  it("refreshes the local identity on each command", async () => {
    await printPrinterSelfTest(tcpInput);
    mocks.getLocalAgentInfo.mockResolvedValue({
      agent_id: "replacement-agent",
      device_code: "replacement-device",
    });
    await printPrinterSelfTest(tcpInput);

    expect(mocks.getLocalAgentInfo).toHaveBeenCalledTimes(2);
    expect(mocks.post).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        agent_id: "replacement-agent",
        device_code: "replacement-device",
      }),
      expect.any(Object),
    );
  });

  it.each([
    { expected_agent_id: "previous-agent", expected_device_code: "local-device" },
    { expected_agent_id: "local-agent", expected_device_code: "previous-device" },
  ])("does not send a saved USB command after the local identity changes (%j)", async (expected) => {
    const input: PrinterSelfTestInput = {
      connect_type: "usb", interface_value: "win:Receipt", ...expected,
    };
    await expect(printPrinterSelfTest(input)).rejects.toMatchObject({ statusCode: 409, delivery_state: "not_sent" });
    await expect(completePrinterSelfTest(input)).rejects.toMatchObject({ statusCode: 409, delivery_state: "not_sent" });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("accepts the live saved USB identity without sending expectation fields to the Agent", async () => {
    await printPrinterSelfTest({
      connect_type: "usb", interface_value: "win:Receipt",
      expected_agent_id: "local-agent", expected_device_code: "local-device",
    });
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      { agent_id: "local-agent", device_code: "local-device", interface_value: "win:Receipt" },
      expect.any(Object),
    );
  });

  it.each([
    "tcp://printer.local:1",
    "tcp://receipt-printer:65535",
    "tcp://printer.local.:9100",
    "tcp://192.168.100.75:9100",
  ])("accepts a TCP printer host and valid port: %s", async (interfaceValue) => {
    await expect(printPrinterSelfTest({
      connect_type: "tcp",
      interface_value: interfaceValue,
    })).resolves.toEqual({ ok: true, status: "command_sent" });
  });

  it.each([
    "cups:EPSON_TM_T88",
    "win:XP-80C Printer",
  ])("accepts an agent USB queue: %s", async (interfaceValue) => {
    await expect(printPrinterSelfTest({
      connect_type: "usb",
      interface_value: interfaceValue,
    })).resolves.toEqual({ ok: true, status: "command_sent" });
  });

  it.each([
    "",
    "192.168.1.20:9100",
    "tcp://192.168.1.256:9100",
    "tcp://192.168.1:9100",
    "tcp://printer:0",
    "tcp://printer:65536",
    "tcp://printer:1.5",
    "tcp://printer:9100/path",
    "tcp://secret@printer:9100",
    "tcp://printer:9100?password=secret",
    "tcp://-printer:9100",
    "tcp://printer..local:9100",
    "tcp://printer\nlocal:9100",
    "cups:Receipt Printer",
  ])("rejects an invalid TCP interface before any transport: %s", async (interfaceValue) => {
    await expect(printPrinterSelfTest({
      connect_type: "tcp",
      interface_value: interfaceValue,
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.getLocalAgentInfo).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.printMobilePrinterSelfTestOverTcp).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "cups:",
    "win:   ",
    "Receipt Printer",
    "tcp://192.168.1.20:9100",
    "cups:Receipt\nPrinter",
    "win:Receipt\u0000Printer",
  ])("rejects an unsupported USB interface: %s", async (interfaceValue) => {
    await expect(printPrinterSelfTest({
      connect_type: "usb",
      interface_value: interfaceValue,
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.getLocalAgentInfo).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("does not send if the local identity is incomplete", async () => {
    mocks.getLocalAgentInfo.mockResolvedValue({ agent_id: "local-agent" });
    await expect(printPrinterSelfTest(tcpInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("does not use a cached or saved identity when the live agent fails", async () => {
    mocks.getLocalAgentInfo.mockRejectedValue(new Error("Agent unavailable with secret config"));
    await expect(printPrinterSelfTest(tcpInput)).rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("explains when the agent must be updated and omits raw response details", async () => {
    mocks.post.mockRejectedValue({
      response: { status: 404, data: { error: "secret-agent-token" } },
    });

    await expect(printPrinterSelfTest(tcpInput)).rejects.toMatchObject({
      statusCode: 404,
      message: "Update Local Printer Agent to use printer self-test.",
      delivery_state: "not_sent",
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failed send or expose transport secrets", async () => {
    mocks.post.mockRejectedValue(new Error("Authorization x-agent-secret: very-secret"));
    const error = await printPrinterSelfTest(tcpInput).catch((value: unknown) => value);
    expect(error).toMatchObject({ statusCode: 503, delivery_state: "unknown" });
    expect(String(error)).not.toContain("very-secret");
    expect(error).not.toHaveProperty("originalError");
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("preserves the agent maintenance code so an existing pause can be recovered", async () => {
    mocks.post.mockRejectedValue({ response: {
      status: 409,
      data: { code: "PRINTER_SELF_TEST_IN_PROGRESS", error: "secret-agent-token" },
    } });
    const error = await printPrinterSelfTest(tcpInput).catch((value: unknown) => value);
    expect(error).toMatchObject({
      statusCode: 409,
      code: "PRINTER_SELF_TEST_IN_PROGRESS",
      delivery_state: "not_sent",
    });
    expect(String(error)).not.toContain("secret-agent-token");
  });

  it("preserves native maintenance recovery without exposing arbitrary transport codes", async () => {
    mocks.isCapacitorMobileApp.mockReturnValue(true);
    mocks.printMobilePrinterSelfTestOverTcp.mockRejectedValueOnce({
      statusCode: 409, code: "PRINTER_SELF_TEST_IN_PROGRESS",
    });
    await expect(printPrinterSelfTest(tcpInput)).rejects.toMatchObject({ code: "PRINTER_SELF_TEST_IN_PROGRESS" });
    mocks.printMobilePrinterSelfTestOverTcp.mockRejectedValueOnce({
      statusCode: 409, code: "secret-arbitrary-code",
    });
    const error = await printPrinterSelfTest(tcpInput).catch((value: unknown) => value);
    expect(error).not.toHaveProperty("code");
    expect(String(error)).not.toContain("secret-arbitrary-code");
  });

  it.each([
    null,
    { ok: false, error: "secret response" },
    { ok: true },
    { ok: true, status: "printed" },
  ])("requires the explicit command-sent response: %j", async (data) => {
    mocks.post.mockResolvedValue({ data });
    await expect(printPrinterSelfTest(tcpInput)).rejects.toMatchObject({ statusCode: 503 });
  });

  it("uses the dedicated native self-test transport", async () => {
    mocks.isCapacitorMobileApp.mockReturnValue(true);
    mocks.printMobilePrinterSelfTestOverTcp.mockResolvedValue(undefined);

    await expect(printPrinterSelfTest(tcpInput)).resolves.toEqual({ ok: true, status: "command_sent" });

    expect(mocks.printMobilePrinterSelfTestOverTcp).toHaveBeenCalledExactlyOnceWith(tcpInput.interface_value);
    expect(mocks.getLocalAgentInfo).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("rejects native USB before contacting an agent or sending bytes", async () => {
    mocks.isCapacitorMobileApp.mockReturnValue(true);
    await expect(printPrinterSelfTest({
      connect_type: "usb",
      interface_value: "cups:Receipt Printer",
    })).rejects.toMatchObject({ statusCode: 501 });
    expect(mocks.getLocalAgentInfo).not.toHaveBeenCalled();
    expect(mocks.printMobilePrinterSelfTestOverTcp).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("completes agent maintenance with the same local identity and unsaved target", async () => {
    mocks.post.mockResolvedValue({ data: { ok: true, status: "ready" } });
    await expect(completePrinterSelfTest(tcpInput)).resolves.toEqual({ ok: true, status: "ready" });
    expect(mocks.getLocalAgentInfo).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      `${AGENT_URL.replace(/\/+$/, "")}/printer/self-test/complete`,
      {
        agent_id: "local-agent",
        device_code: "local-device",
        interface_value: tcpInput.interface_value,
      },
      expect.any(Object),
    );
  });

  it("completes native maintenance without sending more printer bytes", async () => {
    mocks.isCapacitorMobileApp.mockReturnValue(true);
    await expect(completePrinterSelfTest(tcpInput)).resolves.toEqual({ ok: true, status: "ready" });
    expect(mocks.completeMobilePrinterSelfTest).toHaveBeenCalledExactlyOnceWith(tcpInput.interface_value);
    expect(mocks.printMobilePrinterSelfTestOverTcp).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("preserves uncertainty when completion does not return ready", async () => {
    mocks.post.mockResolvedValue({ data: { ok: true, status: "command_sent" } });
    await expect(completePrinterSelfTest(tcpInput)).rejects.toMatchObject({ delivery_state: "unknown" });
  });
});
