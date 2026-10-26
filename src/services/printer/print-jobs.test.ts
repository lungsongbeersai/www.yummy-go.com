import axios, { type AxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ServiceError } from "@/lib/api";
import {
  executeInvoicePrintJobs,
  executeKitchenPrintJobs,
  executeReportPrintJobs,
  type ExecuteKitchenPrintInput,
} from "@/services/printer";

const transportMocks = vi.hoisted(() => ({
  dispatchPrintJob: vi.fn(),
  getLocalAgentInfo: vi.fn(),
  isBrowserDevicePrintJob: vi.fn(),
  printBatchWithLocalAgent: vi.fn(),
  printJobAgentBase: vi.fn(),
  resolvePrinterDeviceContext: vi.fn(),
  resolvePrinterDeviceIdentity: vi.fn(),
}));

vi.mock("@/services/printer/agent-transport", () => transportMocks);

function sharedInput(jobUuid: string): ExecuteKitchenPrintInput {
  return {
    pending_query: {
      print_job_uuid: jobUuid,
      login_uuid_fk: "cashier-1",
      device_code: "owner-device",
      agent_id: "owner-agent",
      remote_shared_print: true,
    },
  };
}

function pendingResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 200,
    data: {
      status: "success",
      data: [],
      print_summary: {
        requested_job_found: true,
        requested_job_status: "printing",
        requested_job_total: 3,
        requested_job_success_total: 1,
        requested_job_failed_total: 0,
        ...overrides,
      },
    },
  };
}

function abortableStalledStatus(config?: AxiosRequestConfig) {
  return new Promise<never>((_resolve, reject) => {
    const abort = () => reject(new axios.CanceledError("Status observation ended"));
    if (config?.signal?.aborted) abort();
    else config?.signal?.addEventListener?.("abort", abort, { once: true });
  });
}

describe("remote Shared print-result observation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    transportMocks.resolvePrinterDeviceIdentity.mockResolvedValue({
      ok: true,
      agent: { device_code: "requester-device", agent_id: "requester-agent" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ["kitchen", executeKitchenPrintJobs],
    ["invoice", executeInvoicePrintJobs],
    ["report", executeReportPrintJobs],
  ] as const)("reports %s success only after the owner's terminal status", async (kind, execute) => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue(pendingResponse({
      requested_job_status: "success",
      requested_job_success_total: 3,
    }));
    const post = vi.spyOn(apiClient, "post");
    const onProgress = vi.fn();

    await expect(execute({ ...sharedInput(`shared-success-${kind}`), onProgress })).resolves.toEqual({
      successCount: 3,
      failedCount: 0,
      total: 3,
    });
    expect(get).toHaveBeenCalledWith("/api/v1/printer/jobs/pending", expect.objectContaining({
      params: expect.objectContaining({
        device_code: "requester-device",
        agent_id: "requester-agent",
        status_only: true,
      }),
      timeout: 10000,
      signal: expect.any(AbortSignal),
    }));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "done" }));
    expect(post).not.toHaveBeenCalled();
    expect(transportMocks.dispatchPrintJob).not.toHaveBeenCalled();
    expect(transportMocks.printBatchWithLocalAgent).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["kitchen", executeKitchenPrintJobs],
    ["invoice/receipt", executeInvoicePrintJobs],
    ["report", executeReportPrintJobs],
  ] as const)("stops a cleared %s job before stale payload dispatch or ACK", async (kind, execute) => {
    const response = pendingResponse({
      requested_job_status: "skipped",
      requested_job_skipped_total: 2,
      print_queue_cleared: true,
      manual_reprint_required: true,
    });
    vi.spyOn(apiClient, "get").mockResolvedValue({
      ...response,
      data: {
        ...response.data,
        print_batch_payloads: [{
          cut_mode: "per_ticket", agent_id: "owner-agent", device_code: "owner-device",
          jobs: [{ job_id: "stale-physical-job" }], job_total: 3,
        }],
      },
    });
    const post = vi.spyOn(apiClient, "post");
    const onProgress = vi.fn();
    const original = sharedInput(`cleared-${kind}`);
    const input = {
      ...original,
      pending_query: { ...original.pending_query!, remote_shared_print: false },
      onProgress,
    };
    await expect(execute(input)).resolves.toEqual({
      successCount: 1, failedCount: 2, total: 3,
      errorMessage: "Print job was cleared. Use a new manual print request.",
    });
    expect(post).not.toHaveBeenCalled();
    expect(transportMocks.getLocalAgentInfo).not.toHaveBeenCalled();
    expect(transportMocks.dispatchPrintJob).not.toHaveBeenCalled();
    expect(transportMocks.printBatchWithLocalAgent).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "done" }));
  });

  it("reports a remote cleared job as manual-reprint failure while preserving real printed rows", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue(pendingResponse({
      requested_job_status: "skipped",
      requested_job_skipped_total: 2,
      print_queue_cleared: true,
    }));
    await expect(executeInvoicePrintJobs(sharedInput("remote-cleared-job"))).resolves.toMatchObject({
      successCount: 1, failedCount: 2, total: 3,
      errorMessage: expect.stringContaining("new manual print"),
    });
  });

  it("stops rapid pending polls without reporting completion or sending another job", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue(pendingResponse());
    const post = vi.spyOn(apiClient, "post");
    const onProgress = vi.fn();
    const execution = executeKitchenPrintJobs({ ...sharedInput("shared-fast-pending"), onProgress });

    await vi.advanceTimersByTimeAsync(9500);
    await expect(execution).resolves.toEqual({ successCount: 1, failedCount: 0, total: 3, pending: true });
    expect(get).toHaveBeenCalledTimes(20);
    expect(onProgress).not.toHaveBeenCalledWith(expect.objectContaining({ phase: "done" }));
    expect(post).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a stalled status GET at the wall-clock deadline", async () => {
    const get = vi.spyOn(apiClient, "get").mockImplementation((_url, config) => abortableStalledStatus(config));
    const post = vi.spyOn(apiClient, "post");
    const execution = executeKitchenPrintJobs(sharedInput("shared-stalled-first"));

    await vi.advanceTimersByTimeAsync(9999);
    const signal = get.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(execution).resolves.toEqual({ successCount: 0, failedCount: 0, total: 0, pending: true });
    expect(signal?.aborted).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends observation when a stalled status adapter ignores both abort and HTTP timeout", async () => {
    const get = vi.spyOn(apiClient, "get").mockImplementation(() => new Promise<never>(() => {}));
    const post = vi.spyOn(apiClient, "post");
    const onProgress = vi.fn();
    let settled = false;
    const execution = executeKitchenPrintJobs({ ...sharedInput("shared-ignores-abort"), onProgress });
    void execution.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(settled).toBe(true);
    await expect(execution).resolves.toEqual({ successCount: 0, failedCount: 0, total: 0, pending: true });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(onProgress).not.toHaveBeenCalledWith(expect.objectContaining({ phase: "done" }));
    expect(post).not.toHaveBeenCalled();
    expect(transportMocks.dispatchPrintJob).not.toHaveBeenCalled();
    expect(transportMocks.printBatchWithLocalAgent).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a terminal status arriving after observation ended and preserves its last confirmed progress", async () => {
    let finishStatus!: (response: ReturnType<typeof pendingResponse>) => void;
    const get = vi.spyOn(apiClient, "get")
      .mockResolvedValueOnce(pendingResponse())
      .mockImplementationOnce(() => new Promise((resolve) => { finishStatus = resolve; }));
    const post = vi.spyOn(apiClient, "post");
    const onProgress = vi.fn();
    let settled = false;
    const execution = executeInvoicePrintJobs({ ...sharedInput("shared-terminal-after-observation"), onProgress });
    void execution.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(settled).toBe(true);
    await expect(execution).resolves.toEqual({ successCount: 1, failedCount: 0, total: 3, pending: true });
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1]?.signal?.aborted).toBe(true);
    const progressBeforeLateStatus = onProgress.mock.calls.length;
    finishStatus(pendingResponse({ requested_job_status: "success", requested_job_success_total: 3 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(onProgress).toHaveBeenCalledTimes(progressBeforeLateStatus);
    expect(onProgress).not.toHaveBeenCalledWith(expect.objectContaining({ phase: "done" }));
    expect(post).not.toHaveBeenCalled();
    expect(transportMocks.dispatchPrintJob).not.toHaveBeenCalled();
    expect(transportMocks.printBatchWithLocalAgent).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a buffered terminal status after sleep even before the delayed deadline timer runs", async () => {
    let finishStatus!: (response: ReturnType<typeof pendingResponse>) => void;
    const get = vi.spyOn(apiClient, "get")
      .mockResolvedValueOnce(pendingResponse())
      .mockImplementationOnce(() => new Promise((resolve) => { finishStatus = resolve; }));
    const post = vi.spyOn(apiClient, "post");
    const onProgress = vi.fn();
    const execution = executeReportPrintJobs({ ...sharedInput("shared-buffered-after-sleep"), onProgress });
    await vi.advanceTimersByTimeAsync(500);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1]?.signal?.aborted).toBe(false);

    vi.setSystemTime(Date.now() + 20_000);
    finishStatus(pendingResponse({ requested_job_status: "success", requested_job_success_total: 3 }));
    await vi.advanceTimersByTimeAsync(0);

    await expect(execution).resolves.toEqual({ successCount: 1, failedCount: 0, total: 3, pending: true });
    expect(get.mock.calls[1][1]?.signal?.aborted).toBe(true);
    expect(onProgress).not.toHaveBeenCalledWith(expect.objectContaining({ phase: "done" }));
    expect(post).not.toHaveBeenCalled();
    expect(transportMocks.dispatchPrintJob).not.toHaveBeenCalled();
    expect(transportMocks.printBatchWithLocalAgent).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("counts delayed status requests against the same budget and preserves observed progress", async () => {
    const get = vi.spyOn(apiClient, "get")
      .mockImplementationOnce(() => new Promise((resolve) => {
        globalThis.setTimeout(() => resolve(pendingResponse()), 3000);
      }))
      .mockImplementation((_url, config) => abortableStalledStatus(config));
    const execution = executeKitchenPrintJobs(sharedInput("shared-delayed-pending"));

    await vi.advanceTimersByTimeAsync(3500);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1]?.timeout).toBe(6500);
    await vi.advanceTimersByTimeAsync(6500);

    await expect(execution).resolves.toEqual({ successCount: 1, failedCount: 0, total: 3, pending: true });
    expect(get.mock.calls[1][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("caps the last poll delay at the remaining deadline", async () => {
    const get = vi.spyOn(apiClient, "get").mockImplementationOnce(() => new Promise((resolve) => {
      globalThis.setTimeout(() => resolve(pendingResponse()), 9800);
    }));
    const execution = executeKitchenPrintJobs(sharedInput("shared-late-pending"));

    await vi.advanceTimersByTimeAsync(10000);

    await expect(execution).resolves.toEqual({ successCount: 1, failedCount: 0, total: 3, pending: true });
    expect(get).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["business", () => Promise.resolve({ status: 200, data: { status: "error", code: 409, message: "Job unavailable" } }), 409],
    ["authorization", () => Promise.resolve({ status: 200, data: { status: "error", code: 403, message: "Job access denied" } }), 403],
    ["transport", () => Promise.reject(new axios.AxiosError("Network Error", "ERR_NETWORK")), 0],
    ["early timeout", () => Promise.reject(new axios.AxiosError("Timed out", "ECONNABORTED")), 408],
    ["missing job", () => Promise.resolve(pendingResponse({ requested_job_found: false })), 404],
  ] as const)("preserves an explicit %s error before the deadline", async (kind, response, statusCode) => {
    vi.spyOn(apiClient, "get").mockImplementation(response);

    await expect(executeKitchenPrintJobs(sharedInput(`shared-error-${kind}`)))
      .rejects.toMatchObject({ name: "ServiceError", statusCode });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports an owner's terminal failure instead of pending", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue(pendingResponse({
      requested_job_status: "partial",
      requested_job_success_total: 1,
      requested_job_failed_total: 2,
    }));

    await expect(executeKitchenPrintJobs(sharedInput("shared-terminal-failure"))).resolves.toEqual({
      successCount: 1, failedCount: 2, total: 3,
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("an active print round owned by another browser execution", () => {
  const request = vi.fn();
  let records: Map<string, string>;

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers();
    records = new Map();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => { records.set(key, value); },
      removeItem: (key: string) => { records.delete(key); },
    } });
    vi.doMock("@/lib/api", () => ({ apiRequest: request, ServiceError }));
    transportMocks.getLocalAgentInfo.mockResolvedValue({ agent_id: "owner-agent", device_code: "owner-device" });
    transportMocks.isBrowserDevicePrintJob.mockReturnValue(false);
    transportMocks.resolvePrinterDeviceIdentity.mockResolvedValue({ ok: true, agent: { agent_id: "owner-agent", device_code: "owner-device" } });
  });

  afterEach(() => {
    vi.doUnmock("@/lib/api");
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function conflict(error = "PRINT_JOB_PRINTING", inProgress?: boolean, status = 409) {
    return Object.assign(new axios.AxiosError("Conflict"), {
      response: { status, data: { error, delivery_state: "unknown", ...(inProgress === undefined ? {} : { in_progress: inProgress }) } },
    });
  }

  function activeFixture(jobUuid: string, kind = "batch", total = 1) {
    const itemUuids = Array.from({ length: total }, (_, index) => `item-${index + 1}`);
    const jobs = itemUuids.map((itemUuid, index) => ({
      job_id: `${jobUuid}-physical-${index}`, print_job_item_uuid: itemUuid,
      print_config_uuid: `printer-${index}`, interface_value: `win:Receipt-${index}`,
      agent_id: "owner-agent", device_code: "owner-device", ops: [],
    }));
    const ackSuccess = { print_job_uuid: jobUuid, results: itemUuids.map((print_job_item_uuid) => ({ print_job_item_uuid, status: "success" })) };
    const ackFailed = { ...ackSuccess, results: ackSuccess.results.map((result) => ({ ...result, status: "failed" })) };
    const payload = kind === "batch" ? {
      print_batch_payloads: jobs.map((job) => ({
        jobs: [job], print_config_uuid: job.print_config_uuid,
        interface_value: job.interface_value, print_job_item_uuids: [job.print_job_item_uuid],
      })),
      ack_success_payload: ackSuccess, ack_failed_payload: ackFailed,
    } : { data: [{ print_items: jobs.map((job, index) => ({
      can_print: true, print_job_item_uuid: job.print_job_item_uuid, job,
      ack_success_payload: { ...ackSuccess, results: [ackSuccess.results[index]] },
      ack_failed_payload: { ...ackFailed, results: [ackFailed.results[index]] },
    })) }] };
    let status = "printing";
    let successCount = 0;
    let found = true;
    request.mockImplementation(async (method: string, _url: string, options?: { params?: { status_only?: boolean }; data?: { results: { status: string }[] } }) => {
      if (method === "post") {
        successCount += options?.data?.results.filter((item) => item.status === "success").length ?? 0;
        if (successCount >= total) status = "success";
        return {};
      }
      if (!options?.params?.status_only) return payload;
      return { print_summary: {
        requested_job_found: found, requested_job_status: status,
        requested_job_total: total, requested_job_success_total: successCount,
        requested_job_failed_total: 0,
      } };
    });
    const original = sharedInput(jobUuid);
    return {
      input: { ...original, pending_query: { ...original.pending_query!, remote_shared_print: false } },
      setStatus(nextStatus: string, count = successCount) { status = nextStatus; successCount = count; },
      setFound(value: boolean) { found = value; },
      acknowledgements: () => request.mock.calls.filter(([method]) => method === "post"),
    };
  }

  it("lets two independent browser realms observe one physical send without a premature failure ACK", async () => {
    const fixture = activeFixture("two-realms");
    let finishPhysical: () => void = () => {};
    transportMocks.printBatchWithLocalAgent
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishPhysical = resolve; }))
      .mockRejectedValueOnce(conflict());
    const firstRealm = await import("./print-jobs");
    const first = firstRealm.executeInvoicePrintJobs(fixture.input);
    await vi.advanceTimersByTimeAsync(0);
    expect(transportMocks.printBatchWithLocalAgent).toHaveBeenCalledOnce();

    vi.resetModules();
    const secondRealm = await import("./print-jobs");
    const onProgress = vi.fn();
    const second = secondRealm.executeInvoicePrintJobs({ ...fixture.input, onProgress });
    await vi.advanceTimersByTimeAsync(0);
    expect(transportMocks.printBatchWithLocalAgent).toHaveBeenCalledTimes(2);
    expect(fixture.acknowledgements()).toEqual([]);
    expect([...records.keys()].filter((key) => key.startsWith("yummy_kitchen_printer_delivery:"))).toEqual([]);
    expect(onProgress).not.toHaveBeenCalledWith(expect.objectContaining({ phase: "done" }));

    finishPhysical();
    await first;
    await vi.advanceTimersByTimeAsync(500);
    await expect(second).resolves.toEqual({ successCount: 1, failedCount: 0, total: 1 });
    expect(fixture.acknowledgements()).toHaveLength(1);
    expect(records.size).toBe(0);
  });

  it.each([
    ["batch", 409], ["legacy-batch", 409], ["legacy-single", 409],
    ["batch", 503], ["legacy-batch", 503], ["legacy-single", 503],
  ] as const)("keeps %s HTTP%s pending and only observes on every later execution or reload", async (kind, status) => {
    const fixture = activeFixture(`pending-${kind}`, kind);
    transportMocks.isBrowserDevicePrintJob.mockReturnValue(kind === "legacy-single");
    transportMocks.printBatchWithLocalAgent.mockRejectedValue(conflict("PRINT_JOB_PENDING", undefined, status));
    transportMocks.dispatchPrintJob.mockRejectedValue(conflict("PRINT_JOB_PENDING", undefined, status));
    let service = await import("./print-jobs");
    const onProgress = vi.fn();
    const first = service.executeInvoicePrintJobs({ ...fixture.input, onProgress });
    await vi.advanceTimersByTimeAsync(9500);
    await expect(first).resolves.toEqual({ successCount: 0, failedCount: 0, total: 1, pending: true });
    expect(onProgress).not.toHaveBeenCalledWith(expect.objectContaining({ phase: "done" }));
    expect(fixture.acknowledgements()).toEqual([]);
    expect([...records.keys()].filter((key) => key.startsWith("yummy_kitchen_printer_delivery:"))).toEqual([]);

    const next = service.executeInvoicePrintJobs(fixture.input);
    await vi.advanceTimersByTimeAsync(9500);
    await expect(next).resolves.toMatchObject({ pending: true, failedCount: 0 });
    vi.resetModules();
    service = await import("./print-jobs");
    fixture.setFound(false);
    await expect(service.executeInvoicePrintJobs(fixture.input)).resolves.toMatchObject({ pending: true, failedCount: 0 });
    fixture.setFound(true);
    fixture.setStatus("success", 1);
    await expect(service.executeInvoicePrintJobs(fixture.input)).resolves.toEqual({ successCount: 1, failedCount: 0, total: 1 });
    expect(transportMocks.printBatchWithLocalAgent.mock.calls.length + transportMocks.dispatchPrintJob.mock.calls.length).toBe(1);
    expect(request.mock.calls.filter(([method, , options]) => method === "get" && !options?.params?.status_only)).toHaveLength(1);
    expect(records.size).toBe(0);
  });

  it("ACKs a different completed printer while leaving the active printer pending", async () => {
    const fixture = activeFixture("mixed-busy", "batch", 2);
    transportMocks.printBatchWithLocalAgent.mockRejectedValueOnce(conflict()).mockResolvedValueOnce(undefined);
    const service = await import("./print-jobs");
    const execution = service.executeKitchenPrintJobs(fixture.input);
    await vi.advanceTimersByTimeAsync(9500);
    await expect(execution).resolves.toEqual({ successCount: 1, failedCount: 0, total: 2, pending: true });
    expect(fixture.acknowledgements()).toHaveLength(1);
    expect(fixture.acknowledgements()[0][2]?.data.results).toEqual([
      expect.objectContaining({ print_job_item_uuid: "item-2", status: "success", delivery_state: "printed" }),
    ]);
  });

  it("withholds a legacy global ACK when an unmapped batch is still active elsewhere", async () => {
    const fixture = activeFixture("mixed-mapless", "batch", 2);
    const implementation = request.getMockImplementation()!;
    request.mockImplementation(async (method: string, url: string, options?: { params?: { status_only?: boolean } }) => {
      const response = await implementation(method, url, options);
      if (options?.params?.status_only) return response;
      return {
        ...response,
        print_batch_payloads: response.print_batch_payloads?.map((batch: { jobs: Record<string, unknown>[] }) => ({
          ...batch, print_job_item_uuids: [],
          jobs: batch.jobs.map((job) => ({ ...job, print_job_item_uuid: undefined })),
        })),
      };
    });
    transportMocks.printBatchWithLocalAgent.mockRejectedValueOnce(conflict()).mockResolvedValueOnce(undefined);
    const service = await import("./print-jobs");
    const execution = service.executeInvoicePrintJobs(fixture.input);
    await vi.advanceTimersByTimeAsync(9500);
    await expect(execution).resolves.toEqual({ successCount: 1, failedCount: 0, total: 2, pending: true });
    expect(fixture.acknowledgements()).toEqual([]);
  });

  it.each(["blocked storage", "failed status read", "missing status fields"])("retains observation after %s without another print POST", async (failure) => {
    const fixture = activeFixture(`observation-${failure}`);
    if (failure === "blocked storage") {
      vi.stubGlobal("window", { get localStorage() { throw new Error("Storage blocked"); } });
    }
    transportMocks.printBatchWithLocalAgent.mockRejectedValueOnce(conflict());
    const implementation = request.getMockImplementation()!;
    let unavailable = true;
    request.mockImplementation((method: string, url: string, options?: { params?: { status_only?: boolean } }) => {
      if (options?.params?.status_only && unavailable) {
        if (failure === "missing status fields") return {};
        throw new ServiceError("Status unavailable", 403);
      }
      return implementation(method, url, options);
    });
    const service = await import("./print-jobs");
    const first = service.executeInvoicePrintJobs(fixture.input);
    if (failure === "missing status fields") await vi.advanceTimersByTimeAsync(9500);
    await expect(first).resolves.toMatchObject({ pending: true, failedCount: 0 });
    unavailable = false;
    fixture.setStatus("success", 1);
    await expect(service.executeInvoicePrintJobs(fixture.input)).resolves.toEqual({ successCount: 1, failedCount: 0, total: 1 });
    expect(transportMocks.printBatchWithLocalAgent).toHaveBeenCalledOnce();
    expect(fixture.acknowledgements()).toEqual([]);
  });

  it("keeps more than 256 observations scoped to their own print rounds", async () => {
    transportMocks.printBatchWithLocalAgent.mockRejectedValue(conflict());
    const service = await import("./print-jobs");
    for (let index = 0; index < 257; index += 1) {
      const fixture = activeFixture(`many-active-${index}`);
      const implementation = request.getMockImplementation()!;
      request.mockImplementation((method: string, url: string, options?: { params?: { status_only?: boolean } }) => {
        if (options?.params?.status_only) throw new ServiceError("Status unavailable", 503);
        return implementation(method, url, options);
      });
      await expect(service.executeInvoicePrintJobs(fixture.input)).resolves.toMatchObject({ pending: true });
    }
    const next = activeFixture("unrelated-new-round");
    transportMocks.printBatchWithLocalAgent.mockResolvedValue(undefined);
    await expect(service.executeInvoicePrintJobs(next.input)).resolves.toEqual({ successCount: 1, failedCount: 0, total: 1 });
    expect(transportMocks.printBatchWithLocalAgent).toHaveBeenCalledTimes(258);
  });

  it.each([
    ["batch", "PRINT_JOB_PRINTING", false, 409],
    ["legacy-batch", "PRINT_JOB_PRINTING", false, 409],
    ["batch", "PRINT_JOB_UNCERTAIN", undefined, 409],
    ["legacy-single", "PRINT_JOB_UNCERTAIN", undefined, 409],
    ["batch", "PRINT_JOB_PRINTING", false, 503],
    ["legacy-batch", "Agent unavailable", undefined, 503],
  ] as const)("retains terminal handling for %s %s in_progress=%s HTTP%s", async (kind, code, active, status) => {
    const fixture = activeFixture(`terminal-${kind}-${code}`, kind);
    transportMocks.isBrowserDevicePrintJob.mockReturnValue(kind === "legacy-single");
    transportMocks.printBatchWithLocalAgent.mockRejectedValue(conflict(code, active, status));
    transportMocks.dispatchPrintJob.mockRejectedValue(conflict(code, active, status));
    const service = await import("./print-jobs");
    await expect(service.executeInvoicePrintJobs(fixture.input)).resolves.toMatchObject({ failedCount: 1 });
    expect(fixture.acknowledgements()[0][2]?.data.results).toEqual([
      expect.objectContaining({ status: "failed", delivery_state: "unknown" }),
    ]);
    expect([...records.keys()].some((key) => key.startsWith("yummy_printer_observation:"))).toBe(false);
  });
});
