import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AckPayload } from "@/services/printer";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn()
}));

const mobileTcpMocks = vi.hoisted(() => ({
  printMobileEscposOverTcp: vi.fn()
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

vi.mock("@capacitor/core", () => ({
  Capacitor: capacitorMocks
}));

vi.mock("@/services/printer/mobile-tcp", () => mobileTcpMocks);

import {
  BROWSER_PRINTER_AGENT_ID,
  BROWSER_PRINTER_AGENT_URL,
  ackPrintJob,
  dispatchPrintJob,
  executeInvoicePrintJobs,
  executeKitchenPrintJobs,
  getPendingPrintJobs,
  getPrinters,
  renderMobileEscpos,
  resolvePrinterDeviceContext,
  resolvePrinterDeviceIdentity,
  savePrinter,
  sendMobileBackendPrintJob,
  type PrintJob
} from "@/services/printer";

function mockLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    })
  };
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

function windowsPrintJob(overrides: Partial<PrintJob> = {}): PrintJob {
  return printJob({
    type: "ops",
    agent_url: "http://10.0.0.20:7777",
    agent_name: "InClude",
    interface_value: "win:USB/ONLY(XP-80)",
    printer_type: "epson",
    job_id: "kitchen-order-1-item-1",
    printer_name: "USB/ONLY(XP-80)",
    print_config_uuid: "51a34c43-f256-4074-84eb-44c9d7668a47",
    print_mode: "windows_agent",
    print_client: "agent",
    requested_by: "user-1",
    meta: {
      order_uuid: "order-1",
      order_item_uuid: "item-1",
      bill_no: "160626-0003"
    },
    ...overrides
  });
}

const successAck: AckPayload = {
  print_job_uuid: "job-1",
  results: [{ print_job_item_uuid: "item-1", status: "success" }]
};

const failedAck: AckPayload = {
  print_job_uuid: "job-1",
  results: [{ print_job_item_uuid: "item-1", status: "failed" }]
};

const successAck2: AckPayload = {
  print_job_uuid: "job-1",
  results: [{ print_job_item_uuid: "item-2", status: "success" }]
};

const failedAck2: AckPayload = {
  print_job_uuid: "job-1",
  results: [{ print_job_item_uuid: "item-2", status: "failed" }]
};

function printerFetchResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: [
      {
        agent_id: "agent-1",
        agent_name: "Local",
        device_code: "device-1",
        print_config_uuid: "printer-1",
        printer_name: "Kitchen",
        connect_type: "tcp",
        interface_value: "tcp://192.168.1.20:9100",
        paper_width_mm: 80,
        is_active: true,
        print_mode: "mobile_wifi",
        role_codes: ["kitchen"],
        cate_uuid_fk: [],
        ...overrides
      }
    ]
  };
}

describe("printer service dispatch", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    axiosMocks.get.mockReset();
    axiosMocks.post.mockReset();
    capacitorMocks.isNativePlatform.mockReset().mockReturnValue(false);
    mobileTcpMocks.printMobileEscposOverTcp.mockReset().mockResolvedValue(undefined);
  });

  it("prints desktop jobs through the local printer agent", async () => {
    const job = printJob();
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });
    axiosMocks.post.mockResolvedValue({ data: { ok: true } });

    await dispatchPrintJob(job);

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

  it("prints browser device jobs through the backend mobile render endpoint", async () => {
    const job = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1"
    });
    apiMocks.apiRequest.mockResolvedValue({ data: { escpos_base64: "BASE64" } });

    await dispatchPrintJob(job);

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/mobile/render-escpos",
      { data: job }
    );
    expect(axiosMocks.get).not.toHaveBeenCalled();
    expect(axiosMocks.post).not.toHaveBeenCalled();
  });

  it("trusts backend mobile print success even without escpos_base64", async () => {
    const job = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1"
    });
    apiMocks.apiRequest.mockResolvedValue({ status: "success", message: "success", data: {} });

    await expect(dispatchPrintJob(job)).resolves.toBeUndefined();
    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/mobile/render-escpos",
      { data: job }
    );
    expect(axiosMocks.get).not.toHaveBeenCalled();
    expect(axiosMocks.post).not.toHaveBeenCalled();
  });

  it("rejects jobs that belong to another device", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });

    await expect(dispatchPrintJob(printJob({ device_code: "device-2" }))).rejects.toThrow(
      "belongs to another agent"
    );
    expect(axiosMocks.post).not.toHaveBeenCalled();
  });

  it("falls back to local agent validation when browser device_code is missing", async () => {
    const job = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "device-1"
    });
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });

    await expect(dispatchPrintJob(job)).rejects.toThrow("belongs to another agent");
    expect(apiMocks.apiRequest).not.toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/mobile/render-escpos",
      expect.anything()
    );
  });

  it("prints matching kitchen jobs as one local batch and acks success", async () => {
    const ackPayloads: unknown[] = [];
    const job = windowsPrintJob();
    const secondJob = windowsPrintJob({
      job_id: "kitchen-order-1-item-2",
      ops: [{ type: "text", text: "Second" }]
    });
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });
    axiosMocks.post.mockResolvedValue({ data: { ok: true } });
    apiMocks.apiRequest.mockImplementation(async (method, url, options) => {
      if (method === "get" && url === "/api/v1/printer/fetch") {
        return printerFetchResponse();
      }
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
                },
                {
                  ack_failed_payload: failedAck2,
                  ack_success_payload: successAck2,
                  can_print: true,
                  job: secondJob,
                  print_job_item_uuid: "item-2"
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
    ).resolves.toEqual({ successCount: 2, failedCount: 0, total: 2 });

    expect(axiosMocks.post).toHaveBeenCalledTimes(1);
    expect(axiosMocks.post).toHaveBeenCalledWith(
      "http://10.0.0.20:7777/print-ops-batch",
      { cut_mode: "per_ticket", jobs: [job, secondJob] },
      expect.objectContaining({ timeout: 20000 })
    );
    expect(ackPayloads).toEqual([
      { ...successAck, login_uuid_fk: "login-1" },
      { ...successAck2, login_uuid_fk: "login-1" }
    ]);
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/printer/jobs/pending", {
      params: {
        print_job_uuid: "job-1",
        login_uuid_fk: "login-1",
        device_code: "device-1",
        agent_id: "agent-1",
        print_mode: "mobile_wifi"
      }
    });
  });

  it("prints invoice pending batch without acking", async () => {
    const progressPhases: string[] = [];
    const job = windowsPrintJob();
    const secondJob = windowsPrintJob({
      job_id: "invoice-item-2",
      ops: [{ type: "text", text: "Second" }]
    });
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });
    axiosMocks.post.mockResolvedValue({ data: { ok: true } });
    apiMocks.apiRequest.mockImplementation(async (method, url) => {
      if (method === "get" && url === "/api/v1/printer/jobs/pending") {
        return {
          print_batch_payloads: [
            {
              cut_mode: "per_ticket",
              agent_id: "agent-1",
              device_code: "device-1",
              jobs: [job, secondJob]
            }
          ],
          ack_success_payload: successAck
        };
      }
      if (method === "post" && url === "/api/v1/printer/jobs/ack") {
        throw new Error("Invoice print should not ack");
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    await expect(
      executeInvoicePrintJobs({
        pending_query: {
          print_job_uuid: "invoice-job-1",
          login_uuid_fk: "login-1",
          device_code: "device-1",
          agent_id: "agent-1",
          print_mode: "windows_agent"
        },
        onProgress: ({ phase }) => progressPhases.push(phase)
      })
    ).resolves.toEqual({ successCount: 2, failedCount: 0, total: 2 });

    expect(progressPhases).toEqual(["fetching", "printing", "done"]);
    expect(axiosMocks.post).toHaveBeenCalledWith(
      "http://10.0.0.20:7777/print-ops-batch",
      {
        cut_mode: "per_ticket",
        agent_id: "agent-1",
        device_code: "device-1",
        jobs: [job, secondJob]
      },
      expect.objectContaining({ timeout: 20000 })
    );
    expect(apiMocks.apiRequest).not.toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/jobs/ack",
      expect.anything()
    );
  });

  it("prints native mobile wifi invoice batches directly over TCP", async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    apiMocks.apiRequest.mockImplementation(async (method, url) => {
      if (method === "get" && url === "/api/v1/printer/jobs/pending") {
        return {
          print_batch_payloads: [
            {
              cut_mode: "per_ticket",
              agent_id: "mobile-agent-1",
              device_code: "mobile-device-1",
              print_mode: "mobile_wifi",
              print_client: "mobile_wifi",
              interface_value: "tcp://192.168.1.20:9100",
              job_total: 1,
              jobs: [],
              mobile_escpos: {
                interface_value: "tcp://192.168.1.20:9100",
                escpos_base64: "BASE64"
              }
            }
          ]
        };
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    await expect(
      executeInvoicePrintJobs({
        pending_query: {
          print_job_uuid: "invoice-job-1",
          login_uuid_fk: "login-1",
          device_code: "mobile-device-1",
          agent_id: "mobile-agent-1",
          print_mode: "mobile_wifi"
        }
      })
    ).resolves.toEqual({ successCount: 1, failedCount: 0, total: 1 });

    expect(mobileTcpMocks.printMobileEscposOverTcp).toHaveBeenCalledWith({
      interface_value: "tcp://192.168.1.20:9100",
      escpos_base64: "BASE64"
    });
    expect(axiosMocks.post).not.toHaveBeenCalled();
  });

  it("falls back before calling the print agent when invoice batch payloads are empty", async () => {
    const progressPhases: string[] = [];
    apiMocks.apiRequest.mockImplementation(async (method, url) => {
      if (method === "get" && url === "/api/v1/printer/jobs/pending") {
        return {
          print_batch_payloads: [],
          print_summary: {
            failed_before_print_total: 1,
            print_batch_total: 0,
            printable_item_total: 0
          },
          ack_failed_payload: {
            print_job_uuid: "invoice-job-1",
            results: [
              {
                print_job_item_uuid: "receipt-1",
                status: "failed",
                reason: "no active printer config for role_code receipt"
              }
            ]
          }
        };
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    await expect(
      executeInvoicePrintJobs({
        pending_query: {
          print_job_uuid: "invoice-job-1",
          login_uuid_fk: "login-1",
          device_code: "device-1",
          agent_id: "agent-1",
          print_mode: "windows_agent"
        },
        onProgress: ({ phase }) => progressPhases.push(phase)
      })
    ).resolves.toEqual({ successCount: 0, failedCount: 1, total: 1 });

    expect(progressPhases).toEqual(["fetching", "done"]);
    expect(axiosMocks.get).not.toHaveBeenCalled();
    expect(axiosMocks.post).not.toHaveBeenCalled();
    expect(apiMocks.apiRequest).not.toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/jobs/ack",
      expect.anything()
    );
  });

  it("uses confirm pending_query directly without resolving printer context again", async () => {
    apiMocks.apiRequest.mockImplementation(async (method, url, options) => {
      if (method === "get" && url === "/api/v1/printer/jobs/pending") {
        expect(options).toEqual({
          params: {
            print_job_uuid: "eba4274d-0173-490c-86d3-52b828d193db",
            login_uuid_fk: "fc445438-e617-471c-9af3-262ae747932f",
            device_code: "INCLUDE",
            agent_id: "include-f8e4f9",
            print_mode: "windows_agent"
          }
        });
        return { data: [] };
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    await expect(
      executeKitchenPrintJobs({
        print_job: {
          print_job_uuid: "eba4274d-0173-490c-86d3-52b828d193db",
          order_uuid: "8ea2f7a8-e21a-4d55-b8d6-70df22e1376b",
          requested_total: 2,
          job_status: "pending"
        },
        pending_query: {
          print_job_uuid: "eba4274d-0173-490c-86d3-52b828d193db",
          login_uuid_fk: "fc445438-e617-471c-9af3-262ae747932f",
          device_code: "INCLUDE",
          agent_id: "include-f8e4f9",
          print_mode: "windows_agent"
        }
      })
    ).resolves.toEqual({ successCount: 0, failedCount: 0, total: 0 });

    expect(axiosMocks.get).not.toHaveBeenCalled();
    expect(apiMocks.apiRequest).toHaveBeenCalledTimes(1);
  });

  it("acks all local kitchen batch items as failed when batch printing fails", async () => {
    const ackPayloads: AckPayload[] = [];
    const job = printJob();
    const secondJob = printJob({ ops: [{ type: "text", text: "Second" }] });
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });
    axiosMocks.post.mockRejectedValue(new Error("batch failed"));
    apiMocks.apiRequest.mockImplementation(async (method, url, options) => {
      if (method === "get" && url === "/api/v1/printer/fetch") {
        return printerFetchResponse();
      }
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
                },
                {
                  ack_failed_payload: failedAck2,
                  ack_success_payload: successAck2,
                  can_print: true,
                  job: secondJob,
                  print_job_item_uuid: "item-2"
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
    ).resolves.toEqual({ successCount: 0, failedCount: 2, total: 2 });

    expect(axiosMocks.post).toHaveBeenCalledWith(
      "http://127.0.0.1:7777/print-ops-batch",
      { cut_mode: "per_ticket", jobs: [job, secondJob] },
      expect.objectContaining({ timeout: 20000 })
    );
    expect(ackPayloads).toEqual([
      {
        print_job_uuid: "job-1",
        login_uuid_fk: "login-1",
        results: [{ print_job_item_uuid: "item-1", status: "failed", reason: "batch failed" }]
      },
      {
        print_job_uuid: "job-1",
        login_uuid_fk: "login-1",
        results: [{ print_job_item_uuid: "item-2", status: "failed", reason: "batch failed" }]
      }
    ]);
  });

  it("splits local kitchen batches by agent URL", async () => {
    const ackPayloads: unknown[] = [];
    const firstJob = windowsPrintJob({ agent_url: "http://10.0.0.20:7777", job_id: "job-agent-a" });
    const secondJob = windowsPrintJob({ agent_url: "http://10.0.0.21:7777", job_id: "job-agent-b" });
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });
    axiosMocks.post.mockResolvedValue({ data: { ok: true } });
    apiMocks.apiRequest.mockImplementation(async (method, url, options) => {
      if (method === "get" && url === "/api/v1/printer/fetch") {
        return printerFetchResponse();
      }
      if (method === "get" && url === "/api/v1/printer/jobs/pending") {
        return {
          data: [
            {
              cut_mode: "per_ticket",
              print_job_uuid: "job-1",
              print_items: [
                {
                  ack_failed_payload: failedAck,
                  ack_success_payload: successAck,
                  can_print: true,
                  job: firstJob,
                  print_job_item_uuid: "item-1"
                },
                {
                  ack_failed_payload: failedAck2,
                  ack_success_payload: successAck2,
                  can_print: true,
                  job: secondJob,
                  print_job_item_uuid: "item-2"
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
    ).resolves.toEqual({ successCount: 2, failedCount: 0, total: 2 });

    expect(axiosMocks.post).toHaveBeenCalledWith(
      "http://10.0.0.20:7777/print-ops-batch",
      { cut_mode: "per_ticket", jobs: [firstJob] },
      expect.objectContaining({ timeout: 20000 })
    );
    expect(axiosMocks.post).toHaveBeenCalledWith(
      "http://10.0.0.21:7777/print-ops-batch",
      { cut_mode: "per_ticket", jobs: [secondJob] },
      expect.objectContaining({ timeout: 20000 })
    );
    expect(ackPayloads).toEqual([
      { ...successAck, login_uuid_fk: "login-1" },
      { ...successAck2, login_uuid_fk: "login-1" }
    ]);
  });

  it("routes browser print jobs through the backend mobile render endpoint", async () => {
    const job = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1",
    });
    apiMocks.apiRequest.mockResolvedValue({ data: { escpos_base64: "BASE64" } });

    await dispatchPrintJob(job);

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/mobile/render-escpos",
      { data: job }
    );
    expect(axiosMocks.get).not.toHaveBeenCalled();
    expect(axiosMocks.post).not.toHaveBeenCalled();
  });

  it("acks browser kitchen jobs after resolving printer context", async () => {
    const ackPayloads: unknown[] = [];
    const job = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1"
    });
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "include-f8e4f9", agent_name: "InClude", device_code: "INCLUDE" }
    });
    apiMocks.apiRequest.mockImplementation(async (method, url, options) => {
      if (method === "get" && url === "/api/v1/printer/fetch") {
        return printerFetchResponse({
          agent_id: BROWSER_PRINTER_AGENT_ID,
          agent_name: "Android Phone",
          device_code: "android-phone-web-device-1"
        });
      }
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
      if (method === "post" && url === "/api/v1/printer/mobile/render-escpos") {
        return { data: { escpos_base64: "BASE64" } };
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

    expect(axiosMocks.get).toHaveBeenCalledTimes(1);
    expect(ackPayloads).toEqual([{ ...successAck, login_uuid_fk: "login-1" }]);
  });

  it("acks failed browser kitchen jobs when backend render fails", async () => {
    const ackPayloads: AckPayload[] = [];
    const job = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1"
    });
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "include-f8e4f9", agent_name: "InClude", device_code: "INCLUDE" }
    });
    apiMocks.apiRequest.mockImplementation(async (method, url, options) => {
      if (method === "get" && url === "/api/v1/printer/fetch") {
        return printerFetchResponse({
          agent_id: BROWSER_PRINTER_AGENT_ID,
          agent_name: "Android Phone",
          device_code: "android-phone-web-device-1"
        });
      }
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
      if (method === "post" && url === "/api/v1/printer/mobile/render-escpos") {
        throw new Error("render failed");
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
    ).resolves.toEqual({ successCount: 0, failedCount: 1, total: 1 });

    expect(axiosMocks.get).toHaveBeenCalledTimes(1);
    expect(ackPayloads).toEqual([
      {
        print_job_uuid: "job-1",
        login_uuid_fk: "login-1",
        results: [{ print_job_item_uuid: "item-1", status: "failed", reason: "render failed" }]
      }
    ]);
  });

  it("prints mixed browser and local kitchen jobs through their own paths", async () => {
    const ackPayloads: unknown[] = [];
    const browserJob = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1"
    });
    const localJob = printJob({ ops: [{ type: "text", text: "Local" }] });
    const localSuccessAck: AckPayload = {
      print_job_uuid: "job-1",
      results: [{ print_job_item_uuid: "item-2", status: "success" }]
    };
    const localFailedAck: AckPayload = {
      print_job_uuid: "job-1",
      results: [{ print_job_item_uuid: "item-2", status: "failed" }]
    };
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "agent-1", agent_name: "Local", device_code: "device-1" }
    });
    axiosMocks.post.mockResolvedValue({ data: { ok: true } });
    apiMocks.apiRequest.mockImplementation(async (method, url, options) => {
      if (method === "get" && url === "/api/v1/printer/fetch") {
        return printerFetchResponse();
      }
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
                  job: browserJob,
                  print_job_item_uuid: "item-1"
                },
                {
                  ack_failed_payload: localFailedAck,
                  ack_success_payload: localSuccessAck,
                  can_print: true,
                  job: localJob,
                  print_job_item_uuid: "item-2"
                }
              ]
            }
          ]
        };
      }
      if (method === "post" && url === "/api/v1/printer/mobile/render-escpos") {
        return { data: { escpos_base64: "BASE64" } };
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
    ).resolves.toEqual({ successCount: 2, failedCount: 0, total: 2 });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/mobile/render-escpos",
      { data: browserJob }
    );
    expect(axiosMocks.post).toHaveBeenCalledWith(
      "http://127.0.0.1:7777/print-ops-batch",
      { cut_mode: "per_ticket", jobs: [localJob] },
      expect.objectContaining({ timeout: 20000 })
    );
    expect(ackPayloads).toEqual([
      { ...successAck, login_uuid_fk: "login-1" },
      { ...localSuccessAck, login_uuid_fk: "login-1" }
    ]);
  });
});

describe("printer ack jobs", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    axiosMocks.get.mockReset();
    axiosMocks.post.mockReset();
  });

  it("posts ack payload with login_uuid_fk", async () => {
    apiMocks.apiRequest.mockResolvedValue({});

    await ackPrintJob({
      login_uuid_fk: "login-1",
      print_job_uuid: "job-1",
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      print_mode: "windows_agent",
      extra_backend_field: "keep-me",
      results: [{ print_job_item_uuid: "item-1", status: "success" }]
    } as AckPayload);

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/printer/jobs/ack", {
      data: {
        login_uuid_fk: "login-1",
        print_job_uuid: "job-1",
        device_code: "INCLUDE",
        agent_id: "include-f8e4f9",
        print_mode: "windows_agent",
        extra_backend_field: "keep-me",
        results: [{ print_job_item_uuid: "item-1", status: "success" }]
      }
    });
  });
});

describe("printer pending jobs", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    axiosMocks.get.mockReset();
    axiosMocks.post.mockReset();
  });

  it("fetches pending jobs scoped by printer identity fields", async () => {
    apiMocks.apiRequest.mockResolvedValue({ data: [] });

    const result = await getPendingPrintJobs({
      print_job_uuid: "job-1",
      login_uuid_fk: "login-1",
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      print_mode: "windows_agent"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/printer/jobs/pending", {
      params: {
        print_job_uuid: "job-1",
        login_uuid_fk: "login-1",
        device_code: "INCLUDE",
        agent_id: "include-f8e4f9",
        print_mode: "windows_agent"
      }
    });
    expect(result.hasBatchPayloads).toBe(false);
    expect(result.batchPayloads).toEqual([]);
  });

  it("preserves an explicitly empty print_batch_payloads response with failed metadata", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      print_batch_payloads: [],
      print_summary: {
        failed_before_print_total: 1,
        print_batch_total: 0,
        printable_item_total: 0
      },
      ack_failed_payload: {
        print_job_uuid: "job-1",
        results: [
          {
            print_job_item_uuid: "item-1",
            status: "failed",
            reason: "no active printer config for role_code receipt"
          }
        ]
      }
    });

    const result = await getPendingPrintJobs({
      print_job_uuid: "job-1",
      login_uuid_fk: "login-1"
    });

    expect(result.hasBatchPayloads).toBe(true);
    expect(result.batchPayloads).toEqual([]);
    expect(result.printSummary.failed_before_print_total).toBe(1);
    expect(result.ackFailed?.results[0]?.reason).toBe("no active printer config for role_code receipt");
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
    axiosMocks.get.mockReset();
    axiosMocks.post.mockReset();
  });

  it("fetches printers scoped by login and device_code", async () => {
    apiMocks.apiRequest.mockResolvedValue({ data: [] });

    await getPrinters({
      login_uuid_fk: "login-1",
      device_code: "android-phone-web-device-1",
      lang: "en"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/printer/fetch",
      {
        params: {
          login_uuid_fk: "login-1",
          device_code: "android-phone-web-device-1",
          lang: "eng"
        }
      }
    );
  });

  it("resolves printer device context from fetched printer settings", async () => {
    const storage = mockLocalStorage();
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "local-agent", agent_name: "Local", device_code: "INCLUDE" }
    });
    apiMocks.apiRequest.mockResolvedValue(
      printerFetchResponse({
        agent_id: "include-f8e4f9",
        agent_name: "Include Agent",
        device_code: "INCLUDE",
        print_mode: "mobile_wifi"
      })
    );

    await expect(resolvePrinterDeviceContext({ login_uuid_fk: "login-1" })).resolves.toEqual({
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      agent_name: "Include Agent",
      print_mode: "mobile_wifi"
    });
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/printer/fetch", {
      params: {
        login_uuid_fk: "login-1",
        device_code: "INCLUDE",
        lang: "la"
      }
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      "yummy_local_printer_agent_identity",
      expect.stringContaining("\"device_code\":\"INCLUDE\"")
    );
  });

  it("uses cached local agent device_code when agent info is temporarily unavailable", async () => {
    mockLocalStorage({
      yummy_local_printer_agent_identity: JSON.stringify({
        agent_id: "include-f8e4f9",
        agent_name: "InClude",
        device_code: "INCLUDE",
        platform: "win32"
      })
    });
    axiosMocks.get.mockRejectedValue(new Error("agent offline"));
    apiMocks.apiRequest.mockResolvedValue(
      printerFetchResponse({
        agent_id: "include-f8e4f9",
        agent_name: "InClude",
        device_code: "INCLUDE",
        print_mode: "windows_agent"
      })
    );

    await expect(resolvePrinterDeviceContext({ login_uuid_fk: "login-1" })).resolves.toEqual({
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      agent_name: "InClude",
      print_mode: "windows_agent"
    });
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/printer/fetch", {
      params: {
        login_uuid_fk: "login-1",
        device_code: "INCLUDE",
        lang: "la"
      }
    });
  });

  it("resolves printer device context from provided device_code without reading agent info", async () => {
    apiMocks.apiRequest.mockResolvedValue(
      printerFetchResponse({
        agent_id: "include-f8e4f9",
        agent_name: "InClude",
        device_code: "INCLUDE",
        print_mode: "windows_agent"
      })
    );

    await expect(resolvePrinterDeviceContext({ login_uuid_fk: "login-1", device_code: "INCLUDE" })).resolves.toEqual({
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      agent_name: "InClude",
      print_mode: "windows_agent"
    });

    expect(axiosMocks.get).not.toHaveBeenCalled();
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/printer/fetch", {
      params: {
        login_uuid_fk: "login-1",
        device_code: "INCLUDE",
        lang: "la"
      }
    });
  });

  it("resolves printer device context from nested fetch payload active printer", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "include-f8e4f9", agent_name: "InClude", device_code: "INCLUDE" }
    });
    apiMocks.apiRequest.mockResolvedValue({
      data: {
        login_uuid_fk: "login-1",
        branch_uuid_fk: "branch-1",
        agent_id: null,
        device_code: "INCLUDE",
        print_mode: null,
        total: 2,
        data: [
          {
            print_config_uuid: "usb-printer-1",
            device_code: "INCLUDE",
            printer_name: "USB/ONLY(XP-80)",
            printer_type: "epson",
            connect_type: "usb",
            interface_value: "win:USB/ONLY(XP-80)",
            agent_url: "http://127.0.0.1:7777",
            agent_id: "include-f8e4f9",
            agent_name: "InClude",
            paper_width_mm: 80,
            is_active: true,
            print_mode: "windows_agent",
            print_client: "agent",
            role_codes: ["k-001"],
            cate_uuid_fk: []
          },
          {
            print_config_uuid: "wifi-printer-1",
            device_code: "INCLUDE",
            printer_name: "WIFI(XP-80)",
            printer_type: "epson",
            connect_type: "tcp",
            interface_value: "tcp://192.168.100.78:9100",
            agent_url: "http://127.0.0.1:7777",
            agent_id: "include-f8e4f9",
            agent_name: "InClude",
            paper_width_mm: 80,
            is_active: false,
            print_mode: "mobile_wifi",
            print_client: "mobile_wifi",
            role_codes: ["k-001"],
            cate_uuid_fk: []
          }
        ]
      }
    });

    await expect(resolvePrinterDeviceContext({ login_uuid_fk: "login-1" })).resolves.toEqual({
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      agent_name: "InClude",
      print_mode: "windows_agent"
    });
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/printer/fetch", {
      params: {
        login_uuid_fk: "login-1",
        device_code: "INCLUDE",
        lang: "la"
      }
    });
  });

  it("rejects printer device context when agent device_code is missing", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { agent_id: "include-f8e4f9", agent_name: "InClude" }
    });

    await expect(resolvePrinterDeviceContext({ login_uuid_fk: "login-1" })).rejects.toThrow("device_code required");
    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
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

  it("can send browser mobile jobs to backend without reading escpos_base64", async () => {
    const job = printJob({
      agent_id: BROWSER_PRINTER_AGENT_ID,
      device_code: "android-phone-web-device-1",
      print_client: "mobile_wifi"
    });
    apiMocks.apiRequest.mockResolvedValue({ status: "success", message: "success", data: {} });

    await expect(sendMobileBackendPrintJob(job)).resolves.toBeUndefined();
    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "post",
      "/api/v1/printer/mobile/render-escpos",
      { data: job }
    );
  });
});
