import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AckPayload } from "@/services/printer";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest,
  ServiceError: class ServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 500) {
      super(message);
      this.name = "ServiceError";
      this.statusCode = statusCode;
    }
  }
}));

vi.mock("axios", () => ({
  default: axiosMocks
}));

import {
  BROWSER_PRINTER_AGENT_ID,
  BROWSER_PRINTER_AGENT_URL,
  executeKitchenPrintJobs,
  getPrinters,
  printOps,
  renderMobileEscpos,
  resolvePrinterDeviceIdentity,
  savePrinter,
  type PrintJob
} from "@/services/printer";

function printJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return {
    agent_id: "agent-1",
    device_code: "device-1",
    interface_value: "tcp://192.168.1.20:9100",
    lang: "la",
    ops: [{ type: "text", text: "Hello" }],
    paper_width_mm: 80,
    printer_type: "receipt",
    ...overrides
  };
}

const successAck: AckPayload = {
  print_job_uuid: "job-1",
  results: [{ print_job_item_uuid: "item-1", status: "success" }]
};

const failedAck: AckPayload = {
  print_job_uuid: "job-1",
  results: [{ print_job_item_uuid: "item-1", status: "failed" }]
};

describe("printer service dispatch", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    axiosMocks.get.mockReset();
    axiosMocks.post.mockReset();
  });

  it("prints desktop jobs through the local printer agent", async () => {
    const job = printJob();
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });
    axiosMocks.post.mockResolvedValue({ data: { ok: true } });

    await printOps(job);

    expect(axiosMocks.get).toHaveBeenCalledWith(
      "http://127.0.0.1:7777/agent/info",
      expect.objectContaining({ timeout: 5000 })
    );
    expect(axiosMocks.post).toHaveBeenCalledWith(
      "http://127.0.0.1:7777/print-ops",
      job,
      expect.objectContaining({ timeout: 10000 })
    );
  });

  it("rejects jobs that belong to another device", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });

    await expect(printOps(printJob({ device_code: "device-2" }))).rejects.toThrow(
      "belongs to another agent"
    );
    expect(axiosMocks.post).not.toHaveBeenCalled();
  });

  it("prints matching kitchen jobs and acks success", async () => {
    const ackPayloads: unknown[] = [];
    const job = printJob();
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });
    axiosMocks.post.mockResolvedValue({ data: { ok: true } });
    apiMocks.apiRequest.mockImplementation(async (method, url, options) => {
      if (method === "get" && url === "/api/v1/printer/jobs/pending") {
        return {
          data: [
            {
              print_job_uuid: "job-1",
              print_items: [
                {
                  ack_failed_payload: failedAck,
                  ack_success_payload: successAck,
                  can_print: true,
                  job,
                  print_job_item_uuid: "item-1"
                }
              ]
            }
          ]
        };
      }
      if (method === "post" && url === "/api/v1/printer/jobs/ack") {
        ackPayloads.push(options?.data);
        return {};
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    await expect(
      executeKitchenPrintJobs({
        pending_query: { print_job_uuid: "job-1", login_uuid_fk: "login-1" }
      })
    ).resolves.toEqual({ successCount: 1, failedCount: 0, total: 1 });

    expect(ackPayloads).toEqual([successAck]);
  });
});

describe("printer device identity", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    axiosMocks.get.mockReset();
    axiosMocks.post.mockReset();
  });

  it("uses desktop local agent info when the agent is available", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Desktop", device_code: "device-1" }
    });

    const result = await resolvePrinterDeviceIdentity();

    expect(result).toEqual({
      ok: true,
      agent: {
        agent_id: "agent-1",
        agent_name: "Desktop",
        device_code: "device-1",
        platform: ""
      }
    });
  });

  it("falls back to a browser device identity when the local agent is unavailable", async () => {
    axiosMocks.get.mockRejectedValue(new Error("agent offline"));

    const result = await resolvePrinterDeviceIdentity();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(["mobile", "desktop"]).toContain(result.agent.agent_id);
    expect(result.agent.agent_name).toBeTruthy();
    expect(result.agent.device_code).toMatch(/^[a-z0-9-]+-web-/);
    expect(result.agent.platform).toBe("browser");
  });

  it("rejects local agent identity when device_code is missing", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Desktop" }
    });

    await expect(resolvePrinterDeviceIdentity()).resolves.toEqual({
      ok: false,
      error: "Printer device identity missing"
    });
  });
});

describe("printer API payloads", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
  });

  it("fetches printers scoped by login, agent_id, and device_code", async () => {
    apiMocks.apiRequest.mockResolvedValue({ data: [] });

    await getPrinters({
      login_uuid_fk: "login-1",
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1",
      lang: "en"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/printer/fetch",
      {
        params: {
          login_uuid_fk: "login-1",
          agent_id: BROWSER_PRINTER_AGENT_ID,
          device_code: "android-phone-web-device-1",
          lang: "eng"
        }
      }
    );
  });

  it("creates TCP printers with browser identity and tcp interface_value", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      data: {
        print_config_uuid: "printer-1",
        printer_name: "Kitchen",
        connect_type: "tcp",
        interface_value: "tcp://192.168.1.20:9100",
        paper_width_mm: 80,
        is_active: true,
        role_codes: ["kitchen"],
        cate_uuid_fk: []
      }
    });

    await savePrinter({
      login_uuid_fk: "login-1",
      display_name: "Kitchen",
      connect_type: "tcp",
      ip: "192.168.1.20",
      port: 9100,
      paper_width_mm: 80,
      role_codes: ["kitchen"],
      agent_url: BROWSER_PRINTER_AGENT_URL,
      agent_id: BROWSER_PRINTER_AGENT_ID,
      agent_name: "Android Phone",
      device_code: "android-phone-web-device-1"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/create",
      {
        data: expect.objectContaining({
          agent_url: BROWSER_PRINTER_AGENT_URL,
          agent_id: BROWSER_PRINTER_AGENT_ID,
          agent_name: "Android Phone",
          device_code: "android-phone-web-device-1",
          ip: "192.168.1.20",
          port: 9100,
          interface_value: "tcp://192.168.1.20:9100"
        })
      }
    );
  });

  it("can request backend ESC/POS render for browser mobile jobs", async () => {
    const job = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1",
      print_client: "mobile_wifi"
    });
    apiMocks.apiRequest.mockResolvedValue({ data: { escpos_base64: "BASE64" } });

    await expect(renderMobileEscpos(job)).resolves.toBe("BASE64");
    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/mobile/render-escpos",
      { data: job }
    );
  });
});
