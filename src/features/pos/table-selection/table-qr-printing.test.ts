import { describe, expect, it, vi } from "vitest";
import {
  buildQrPrintDocument,
  createQrPrintRound,
  tableQrPrintAttemptResponse,
  tableQrPrintOutcome,
} from "./table-qr-printing";

describe("table QR printing", () => {
  it("does not report an empty or pending QR result as printed", () => {
    expect(tableQrPrintOutcome({ successCount: 0, failedCount: 0, pending: true })).toBe("pending");
    expect(tableQrPrintOutcome({ successCount: 0, failedCount: 0 })).toBe("error");
    expect(tableQrPrintOutcome({ successCount: 1, failedCount: 0 })).toBe("success");
  });

  it.each([
    { successCount: 1, failedCount: 0, total: 20 },
    { successCount: 20, failedCount: 0, total: 20, errorMessage: "Another printer is uncertain" },
    { successCount: 1, failedCount: 1, total: 2, pending: true },
    { successCount: 1, failedCount: 0, total: 0 },
  ])("keeps an incomplete or failed QR result out of printed success: %j", (result) => {
    expect(tableQrPrintOutcome(result)).toBe("error");
  });

  it("requires all requested menu QR copies even if an older server reports only one successful sheet", () => {
    expect(tableQrPrintOutcome({ successCount: 1, failedCount: 0, total: 1 }, 20)).toBe("error");
    expect(tableQrPrintOutcome({ successCount: 19, failedCount: 0, total: 20 }, 20)).toBe("error");
    expect(tableQrPrintOutcome({ successCount: 19, failedCount: 0, total: 20, pending: true }, 20)).toBe("pending");
    expect(tableQrPrintOutcome({ successCount: 20, failedCount: 0, total: 20 }, 20)).toBe("success");
    expect(tableQrPrintOutcome({ successCount: 21, failedCount: 0, total: 21 }, 20)).toBe("error");
    expect(tableQrPrintOutcome({ successCount: 30, failedCount: 0, total: 30 }, 20)).toBe("error");
    expect(tableQrPrintOutcome({ successCount: 21, failedCount: 0, total: 20 }, 20)).toBe("error");
  });

  interface QueuedQr {
    pending_query?: {
      print_job_uuid: string;
      login_uuid_fk?: string;
      device_code?: string;
      agent_id?: string;
      remote_shared_print?: boolean;
    };
    qr_url?: string;
  }

  it("locks repeated clicks synchronously and observes the original owner's pending job without enqueueing again", async () => {
    const createId = vi.fn().mockReturnValueOnce("operation-1").mockReturnValueOnce("operation-2");
    const print = createQrPrintRound<QueuedQr>(createId);
    const response = { pending_query: {
      print_job_uuid: "original-shared-job", login_uuid_fk: "cashier",
      device_code: "SHARED-OWNER", agent_id: "shared-agent", remote_shared_print: true,
    } };
    const first = print.begin(20)!;
    expect(print.begin(20)).toBeNull();
    first.remember(response);
    first.settle("pending");
    first.release();

    // A later copy-control value must not mutate a pending print's contents.
    const observation = print.begin(1)!;
    const requestQueue = vi.fn();
    expect(observation.operationUuid).toBe(first.operationUuid);
    expect(observation.copies).toBe(20);
    await expect(tableQrPrintAttemptResponse({
      refreshQueue: !observation.response, response: observation.response, requestQueue,
    })).resolves.toBe(response);
    expect(requestQueue).not.toHaveBeenCalled();
    observation.settle("success");
    observation.release();

    const nextPrint = print.begin(1)!;
    expect(nextPrint.operationUuid).toBe("operation-2");
    expect(nextPrint.response).toBeNull();
    expect(nextPrint.copies).toBe(1);
    expect(createId).toHaveBeenCalledTimes(2);
    nextPrint.release();
  });

  it("retries a lost queue response using the same operation and copy count", async () => {
    const createId = vi.fn().mockReturnValue("stable-operation");
    const print = createQrPrintRound<QueuedQr>(createId);
    const requestQueue = vi.fn().mockRejectedValueOnce(new Error("Queue response lost"))
      .mockResolvedValueOnce({ pending_query: { print_job_uuid: "already-queued" } });
    const first = print.begin(20)!;
    try {
      await expect(tableQrPrintAttemptResponse({
        refreshQueue: true, response: null,
        requestQueue: () => requestQueue(first.operationUuid, first.copies),
      })).rejects.toThrow("Queue response lost");
    } finally {
      first.release();
    }
    const retry = print.begin(1)!;
    const recovered = await tableQrPrintAttemptResponse({
      refreshQueue: !retry.response, response: retry.response,
      requestQueue: () => requestQueue(retry.operationUuid, retry.copies),
    });
    expect(recovered?.pending_query?.print_job_uuid).toBe("already-queued");
    expect(requestQueue.mock.calls).toEqual([["stable-operation", 20], ["stable-operation", 20]]);
    expect(createId).toHaveBeenCalledOnce();
    retry.release();
  });

  it("retains a queued job across a status failure and starts a new round only after a terminal result", () => {
    const createId = vi.fn().mockReturnValueOnce("first-operation").mockReturnValueOnce("manual-operation");
    const print = createQrPrintRound<QueuedQr>(createId);
    const response = { pending_query: { print_job_uuid: "one-physical-job" } };
    const first = print.begin()!;
    first.remember(response);
    // No terminal result arrived when its status request failed.
    first.release();
    const status = print.begin()!;
    expect(status.response).toBe(response);
    expect(status.operationUuid).toBe("first-operation");
    status.settle("error");
    status.release();
    const manual = print.begin()!;
    expect(manual.response).toBeNull();
    expect(manual.operationUuid).toBe("manual-operation");
    manual.release();
  });

  it("does not replace an unresolved operation with a response that has no durable job identity", () => {
    const print = createQrPrintRound<QueuedQr>(() => "stable-operation");
    const first = print.begin()!;
    first.remember({ qr_url: "https://example.test/menu" });
    first.release();
    const retry = print.begin()!;
    expect(retry.response).toBeNull();
    expect(retry.operationUuid).toBe("stable-operation");
    retry.release();
  });

  it("does not let an old completion unlock a newer in-flight attempt", () => {
    const print = createQrPrintRound<QueuedQr>();
    const first = print.begin()!;
    first.release();
    const second = print.begin()!;
    first.release();
    expect(print.begin()).toBeNull();
    second.release();
    expect(print.begin()).not.toBeNull();
  });

  it("rejects an old view's print click before allocating an operation", () => {
    const createId = vi.fn().mockReturnValue("current-operation");
    let current = false;
    const print = createQrPrintRound<QueuedQr>(createId, () => current);
    expect(print.begin()).toBeNull();
    expect(createId).not.toHaveBeenCalled();
    current = true;
    const attempt = print.begin()!;
    expect(attempt.operationUuid).toBe("current-operation");
    attempt.release();
    current = false;
    expect(print.begin()).toBeNull();
  });

  it.each([0, 21, 1.5, Number.NaN])("rejects invalid QR copy count %s before holding an attempt lock", (copies) => {
    const print = createQrPrintRound<QueuedQr>();
    expect(() => print.begin(copies)).toThrow("between 1 and 20");
    expect(print.begin(1)).not.toBeNull();
  });

  it("creates a fresh QR queue only when retrying a terminal print attempt", async () => {
    const requestQueue = vi.fn().mockResolvedValue({ print_job_uuid: "job-new" });
    const previous = { print_job_uuid: "job-failed" };

    await expect(tableQrPrintAttemptResponse({
      refreshQueue: false,
      requestQueue,
      response: previous,
    })).resolves.toBe(previous);
    expect(requestQueue).not.toHaveBeenCalled();

    await expect(tableQrPrintAttemptResponse({
      refreshQueue: true,
      requestQueue,
      response: previous,
    })).resolves.toEqual({ print_job_uuid: "job-new" });
    expect(requestQueue).toHaveBeenCalledTimes(1);
  });

  it("does not request a QR print for an invalidated view or execute a job returned after a branch change", async () => {
    let current = false;
    const requestQueue = vi.fn(async () => { current = false; return { print_job_uuid: "old-branch-job" }; });
    await expect(tableQrPrintAttemptResponse({ refreshQueue: true, requestQueue, response: null, isCurrent: () => current })).rejects.toMatchObject({ name: "AbortError" });
    expect(requestQueue).not.toHaveBeenCalled();
    current = true;
    await expect(tableQrPrintAttemptResponse({ refreshQueue: true, requestQueue, response: null, isCurrent: () => current })).rejects.toMatchObject({ name: "AbortError" });
    expect(requestQueue).toHaveBeenCalledOnce();
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
