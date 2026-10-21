import axios, { type AxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api";
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
