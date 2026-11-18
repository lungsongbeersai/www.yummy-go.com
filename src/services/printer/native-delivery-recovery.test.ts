import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AckPayload } from "@/services/printer";

const mocks = vi.hoisted(() => ({ request: vi.fn(), send: vi.fn(), sunmiSend: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiRequest: mocks.request,
  ServiceError: class extends Error {},
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@/services/printer/mobile-tcp", () => ({ printMobileEscposOverTcp: mocks.send }));
vi.mock("@/services/printer/agent-transport", () => ({
  dispatchPrintJob: mocks.send,
  getLocalAgentInfo: vi.fn(),
  isBrowserDevicePrintJob: () => true,
  printBatchWithLocalAgent: vi.fn(),
  printJobAgentBase: vi.fn(),
  resolvePrinterDeviceContext: vi.fn(),
  resolvePrinterDeviceIdentity: vi.fn(),
}));
vi.mock("@/services/printer/config-api", () => ({ renderMobileEscpos: vi.fn() }));
vi.mock("@/services/printer/sunmi-native", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/printer/sunmi-native")>(),
  printSunmiEscpos: mocks.sunmiSend,
}));

function storage() {
  const records = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => records.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { records.set(key, value); }),
    removeItem: vi.fn((key: string) => { records.delete(key); }),
  };
  vi.stubGlobal("window", { localStorage });
  return { records, localStorage };
}

function fixture(jobUuid: string, legacy = false, sunmi = false, raw = true) {
  const itemUuids = ["item-1", "item-2"];
  const jobs = itemUuids.map((itemUuid) => ({
    print_job_item_uuid: itemUuid,
    job_id: `physical-${itemUuid}`,
    print_config_uuid: "printer-1",
    interface_value: sunmi ? "sunmi://builtin" : "tcp://192.0.2.1:9100",
    ...(sunmi ? { agent_id: "sunmi-native", device_code: "android-native-terminal1", print_mode: "sunmi_builtin" } : {}),
    ops: [], paper_width_mm: 80, printer_type: "epson", lang: "la",
  }));
  const results = itemUuids.map((print_job_item_uuid) => ({ print_job_item_uuid, status: "success" }));
  const ackSuccess = { print_job_uuid: jobUuid, results };
  const ackFailed = { ...ackSuccess, results: results.map((result) => ({ ...result, status: "failed" })) };
  const payload = legacy ? {
    data: [{ print_items: [{
      can_print: true, print_job_item_uuid: itemUuids[0], job: jobs[0],
      ack_success_payload: { ...ackSuccess, results: results.slice(0, 1) },
      ack_failed_payload: { ...ackFailed, results: ackFailed.results.slice(0, 1) },
    }] }],
  } : {
    print_batch_payloads: [{
      jobs, print_config_uuid: "printer-1", print_client: "mobile_wifi",
      ...(sunmi ? { agent_id: "sunmi-native", device_code: "android-native-terminal1", print_mode: "sunmi_builtin", print_client: "sunmi_builtin" } : {}),
      mobile_escpos: { interface_value: jobs[0].interface_value, escpos_base64: raw ? "G0A=" : null },
      print_job_item_uuids: itemUuids,
    }],
    ack_success_payload: ackSuccess,
    ack_failed_payload: ackFailed,
  };
  const acknowledgements: AckPayload[] = [];
  mocks.request.mockImplementation(async (method: string, url: string, options?: { data?: AckPayload }) => {
    if (method === "get" && url === "/api/v1/printer/jobs/pending") return payload;
    if (method === "post" && url === "/api/v1/printer/jobs/ack") {
      acknowledgements.push(options!.data!);
      return {};
    }
    throw new Error(`Unexpected request ${method} ${url}`);
  });
  return {
    payload,
    acknowledgements,
    input: { pending_query: { print_job_uuid: jobUuid, login_uuid_fk: "cashier", device_code: "native", agent_id: "native-agent" } },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.send.mockResolvedValue(undefined);
  mocks.sunmiSend.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("native delivery recovery after WebView restart", () => {
  it("fails a missing SUNMI prepared batch before sending instead of changing to item-level print keys", async () => {
    storage();
    const { input, acknowledgements } = fixture("sunmi-missing-raw", false, true, false);
    const { executeInvoicePrintJobs } = await import("@/services/printer/print-jobs");
    await expect(executeInvoicePrintJobs(input)).resolves.toMatchObject({ successCount: 0, failedCount: 2 });
    expect(mocks.sunmiSend).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(acknowledgements.at(-1)?.results.every((result) => result.delivery_state === "not_sent")).toBe(true);
  });

  it("never prints an old receiver session's late pending response", async () => {
    storage();
    const setup = fixture("sunmi-old-pending", false, true);
    const request = mocks.request.getMockImplementation()!;
    let finish!: (value: typeof setup.payload) => void;
    mocks.request.mockImplementation((method, url, options) => method === "get"
      ? new Promise((resolve) => { finish = resolve; }) : request(method, url, options));
    const { executeInvoicePrintJobs } = await import("@/services/printer/print-jobs");
    const printing = executeInvoicePrintJobs(setup.input);
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
    const { resetSessionStores } = await import("@/stores/session-store-registry");
    resetSessionStores();
    finish(setup.payload);
    await expect(printing).resolves.toMatchObject({ successCount: 0, failedCount: 2 });
    expect(mocks.sunmiSend).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("keeps the canonical SUNMI batch key for a changed pending subset and stops a native conflict", async () => {
    storage();
    const first = fixture("sunmi-subset", false, true);
    const { executeInvoicePrintJobs } = await import("@/services/printer/print-jobs");
    await executeInvoicePrintJobs(first.input);
    const next = fixture("sunmi-subset", false, true);
    const batch = next.payload.print_batch_payloads![0];
    batch.jobs = batch.jobs.slice(1);
    batch.print_job_item_uuids = batch.print_job_item_uuids.slice(1);
    batch.mobile_escpos.escpos_base64 = "G0EK";
    mocks.sunmiSend.mockRejectedValueOnce(Object.assign(new Error("SUNMI job payload conflict"), { delivery_state: "unknown" }));
    await expect(executeInvoicePrintJobs(next.input)).resolves.toMatchObject({ successCount: 0, failedCount: 1 });
    expect(mocks.sunmiSend).toHaveBeenCalledTimes(2);
    expect(mocks.sunmiSend.mock.calls.map(([request]) => request.jobId))
      .toEqual(["batch:sunmi-subset:printer-1", "batch:sunmi-subset:printer-1"]);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("delivers a SUNMI batch through the SDK with stable identities and never TCP", async () => {
    storage();
    const { input, acknowledgements } = fixture("sunmi-paper", false, true);
    const { executeInvoicePrintJobs } = await import("@/services/printer/print-jobs");
    await expect(executeInvoicePrintJobs(input)).resolves.toMatchObject({ successCount: 2, failedCount: 0 });
    expect(mocks.sunmiSend).toHaveBeenCalledExactlyOnceWith({
      target: { agent_id: "sunmi-native", device_code: "android-native-terminal1", print_mode: "sunmi_builtin", interface_value: "sunmi://builtin" },
      jobId: "batch:sunmi-paper:printer-1", escposBase64: "G0A=",
    });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(acknowledgements.at(-1)?.results.every((result) => result.delivery_state === "printed")).toBe(true);
  });

  it("does not ACK SUNMI paper before SDK transaction completion", async () => {
    storage();
    const { input, acknowledgements } = fixture("sunmi-pending", false, true);
    let finish!: () => void;
    mocks.sunmiSend.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { executeInvoicePrintJobs } = await import("@/services/printer/print-jobs");
    const printing = executeInvoicePrintJobs(input);
    await vi.waitFor(() => expect(mocks.sunmiSend).toHaveBeenCalledOnce());
    expect(acknowledgements).toEqual([]);
    finish();
    await expect(printing).resolves.toMatchObject({ successCount: 2, failedCount: 0 });
    expect(acknowledgements.at(-1)?.results.every((result) => result.delivery_state === "printed")).toBe(true);
  });

  it("blocks SUNMI replay after an interrupted WebView without switching transport", async () => {
    const saved = storage();
    const { input, acknowledgements } = fixture("sunmi-interrupted", false, true);
    mocks.sunmiSend.mockImplementation(() => new Promise<never>(() => {}));
    const first = await import("@/services/printer/print-jobs");
    void first.executeInvoicePrintJobs(input);
    await vi.waitFor(() => expect(mocks.sunmiSend).toHaveBeenCalledOnce());
    expect([...saved.records.values()].map((value) => JSON.parse(value)))
      .toContainEqual(expect.objectContaining({ deliveryState: "unknown" }));
    vi.resetModules();
    const restarted = await import("@/services/printer/print-jobs");
    await expect(restarted.executeInvoicePrintJobs(input)).resolves.toMatchObject({ successCount: 0, failedCount: 2 });
    expect(mocks.sunmiSend).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(acknowledgements.at(-1)?.results.every((result) => result.delivery_state === "unknown")).toBe(true);
  });

  it.each(["kitchen", "document", "legacy-document"])("blocks replay of an interrupted %s before any delivery Promise settles", async (kind) => {
    const saved = storage();
    const { input, acknowledgements } = fixture(`interrupted-${kind}`, kind === "legacy-document");
    const load = () => import("@/services/printer/print-jobs");
    const first = await load();
    mocks.send.mockImplementation(() => new Promise<never>(() => {}));
    void (kind === "kitchen" ? first.executeKitchenPrintJobs(input) : first.executeInvoicePrintJobs(input));
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    expect([...saved.records.values()].map((value) => JSON.parse(value))).toContainEqual(expect.objectContaining({ deliveryState: "unknown" }));

    vi.resetModules();
    const restarted = await load();
    const result = await (kind === "kitchen" ? restarted.executeKitchenPrintJobs(input) : restarted.executeInvoicePrintJobs(input));
    expect(result).toMatchObject({ successCount: 0, failedCount: kind === "legacy-document" ? 1 : 2 });
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(acknowledgements.at(-1)?.results.every((item) => item.delivery_state === "unknown")).toBe(true);
  });

  it("persists a confirmed ticket prefix while the rest of the native batch is still sending", async () => {
    storage();
    const { input, acknowledgements } = fixture("partial-interruption");
    mocks.send.mockImplementation(({ on_ticket_delivered }: { on_ticket_delivered?: (completed: number, total: number) => void }) => {
      on_ticket_delivered?.(1, 2);
      return new Promise<never>(() => {});
    });
    const first = await import("@/services/printer/print-jobs");
    void first.executeInvoicePrintJobs(input);
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
    vi.resetModules();
    const restarted = await import("@/services/printer/print-jobs");
    await expect(restarted.executeInvoicePrintJobs(input)).resolves.toMatchObject({ successCount: 1, failedCount: 1, total: 2 });
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(acknowledgements.at(-1)?.results).toEqual([
      expect.objectContaining({ print_job_item_uuid: "item-1", delivery_state: "printed", status: "success" }),
      expect.objectContaining({ print_job_item_uuid: "item-2", delivery_state: "unknown", status: "failed" }),
    ]);
  });

  it.each(["missing", "throws", "no-op"])("fails closed before native sending when durable storage is %s", async (kind) => {
    const saved = storage();
    if (kind === "missing") vi.unstubAllGlobals();
    if (kind === "throws") saved.localStorage.setItem.mockImplementation(() => { throw new Error("Storage full"); });
    if (kind === "no-op") saved.localStorage.setItem.mockImplementation(() => {});
    const { input, acknowledgements } = fixture(`storage-${kind}`);
    const { executeInvoicePrintJobs } = await import("@/services/printer/print-jobs");
    await expect(executeInvoicePrintJobs(input)).resolves.toMatchObject({ successCount: 0, failedCount: 2 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(acknowledgements.at(-1)?.results.every((item) => item.delivery_state === "not_sent")).toBe(true);
  });

  it("retains definitely-unsent state after a failed connection and permits a fresh manual print", async () => {
    const saved = storage();
    const first = fixture("connection-failure");
    mocks.send.mockRejectedValueOnce(Object.assign(new Error("Connection refused"), { delivery_state: "not_sent" }));
    const original = await import("@/services/printer/print-jobs");
    await original.executeInvoicePrintJobs(first.input);
    expect([...saved.records.values()].map((value) => JSON.parse(value))).toContainEqual(expect.objectContaining({ deliveryState: "not_sent" }));
    vi.resetModules();
    const restarted = await import("@/services/printer/print-jobs");
    await restarted.executeInvoicePrintJobs(first.input);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(first.acknowledgements.at(-1)?.results.every((item) => item.delivery_state === "not_sent")).toBe(true);
    const next = fixture("manual-fresh-round");
    await expect(restarted.executeInvoicePrintJobs(next.input)).resolves.toMatchObject({ successCount: 2, failedCount: 0 });
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("replays the recorded printed result after a lost ACK without sending bytes again", async () => {
    storage();
    const { input } = fixture("lost-ack-restart");
    const request = mocks.request.getMockImplementation()!;
    let failAck = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.request.mockImplementation((method, url, options) => {
      if (method === "post" && url === "/api/v1/printer/jobs/ack" && failAck) return Promise.reject(new Error("ACK lost"));
      return request(method, url, options);
    });
    try {
      const first = await import("@/services/printer/print-jobs");
      await first.executeInvoicePrintJobs(input);
      vi.resetModules();
      failAck = false;
      const restarted = await import("@/services/printer/print-jobs");
      await expect(restarted.executeInvoicePrintJobs(input)).resolves.toMatchObject({ successCount: 2, failedCount: 0 });
      expect(mocks.send).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });
});
