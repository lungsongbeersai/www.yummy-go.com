import { describe, expect, it, vi } from "vitest";
import {
  createCheckoutDocumentActionGuard,
  finishCommittedPayment,
  isInvoicePrintPreparationError,
  queuedDocumentPrintOutcome,
} from "./queued-document-print";

function deferred() {
  let resolve = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("checkout document action guard", () => {
  it("blocks repeated invoice/payment actions for the same order across dialog instances", () => {
    const guard = createCheckoutDocumentActionGuard();
    const release = guard.acquire("cashier:order-1");
    expect(release).not.toBeNull();
    expect(guard.isActive("cashier:order-1")).toBe(true);
    expect(guard.acquire("cashier:order-1")).toBeNull();
    expect(guard.acquire("cashier:order-2")).not.toBeNull();
    release?.();
    expect(guard.acquire("cashier:order-1")).not.toBeNull();
  });

  it("an old release cannot unlock the next action for the same order", () => {
    const guard = createCheckoutDocumentActionGuard();
    const releaseOld = guard.acquire("order-1");
    releaseOld?.();
    const releaseNew = guard.acquire("order-1");
    releaseOld?.();
    expect(guard.isActive("order-1")).toBe(true);
    releaseNew?.();
    expect(guard.isActive("order-1")).toBe(false);
  });
});

describe("finishCommittedPayment", () => {
  it("keeps the payment dialog available for print loading until receipt delivery settles", async () => {
    const printer = deferred();
    const events: string[] = [];
    const onPrintError = vi.fn();
    const completion = finishCommittedPayment({
      print: () => { events.push("print original job"); return printer.promise; },
      onCommitted: () => { events.push("close paid dialog"); },
      refresh: async () => { events.push("refresh orders"); },
      onPrintError,
    });
    await Promise.resolve();
    expect(events).toEqual(["print original job"]);
    printer.resolve();
    const result = await completion;
    expect(events).toEqual(["print original job", "close paid dialog", "refresh orders"]);
    expect(result).toEqual({});
    expect(onPrintError).not.toHaveBeenCalled();
  });

  it("reports the original receipt failure before completing the already committed payment", async () => {
    const printer = deferred();
    const originalJob = Object.freeze({ jobUuid: "receipt-1", invoice: "INV-1", table: "A1" });
    let activeInvoice = "INV-1";
    const failures: { job: typeof originalJob; error: unknown }[] = [];
    const completion = finishCommittedPayment({
      print: () => printer.promise,
      onCommitted: () => { activeInvoice = "INV-2"; },
      refresh: async () => {},
      onPrintError: (error) => { failures.push({ job: originalJob, error }); },
    });
    expect(activeInvoice).toBe("INV-1");
    const failure = new Error("Printer disconnected after checkout");
    printer.reject(failure);
    await completion;
    expect(failures).toEqual([{ job: originalJob, error: failure }]);
    expect(activeInvoice).toBe("INV-2");
  });

  it("reports refresh failure separately after committed payment without cancelling its receipt", async () => {
    const printer = deferred();
    const failure = new Error("Refresh unavailable");
    const close = vi.fn();
    const onPrintError = vi.fn();
    const completion = finishCommittedPayment({
      print: () => printer.promise,
      onCommitted: close,
      refresh: async () => { throw failure; },
      onPrintError,
    });
    expect(close).not.toHaveBeenCalled();
    printer.resolve();
    const result = await completion;
    expect(result.refreshError).toBe(failure);
    expect(close).toHaveBeenCalledOnce();
    expect(onPrintError).not.toHaveBeenCalled();
  });

  it("handles a synchronous print failure without preventing committed payment completion", async () => {
    const failure = new Error("Invalid queued receipt");
    const onPrintError = vi.fn();
    const close = vi.fn();
    const refresh = vi.fn(async () => {});
    await finishCommittedPayment({
      print: () => { throw failure; },
      onCommitted: close,
      refresh,
      onPrintError,
    });
    expect(onPrintError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(close).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps a close-dialog error separate from payment failure and still refreshes orders", async () => {
    const failure = new Error("Dialog completion failed");
    const refresh = vi.fn(async () => {});
    const print = vi.fn(async () => {});
    const result = await finishCommittedPayment({
      print,
      onCommitted: () => { throw failure; },
      refresh,
      onPrintError: vi.fn(),
    });
    expect(result.completionError).toBe(failure);
    expect(print).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("still completes the paid order when reporting a printer failure itself throws", async () => {
    const failure = new Error("Unable to display printer error");
    const close = vi.fn();
    const refresh = vi.fn(async () => {});
    const result = await finishCommittedPayment({
      print: async () => { throw new Error("Printer unavailable"); },
      onPrintError: () => { throw failure; },
      onCommitted: close,
      refresh,
    });
    expect(result.completionError).toBe(failure);
    expect(close).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe("isInvoicePrintPreparationError", () => {
  it("prevents a cached invoice fallback when the backend could not prepare authoritative items", () => {
    const error = Object.assign(new Error("INVOICE_PRINT_PREPARATION_FAILED"), {
      statusCode: 503,
      payload: {
        status: "error",
        code: 503,
        error_code: "INVOICE_PRINT_PREPARATION_FAILED",
        order_uuid: "order-1",
        operation_uuid: "invoice-operation-1",
      },
    });
    expect(isInvoicePrintPreparationError(error)).toBe(true);
  });

  it("preserves existing fallback handling for other errors and older servers", () => {
    for (const error of [
      null,
      undefined,
      "INVOICE_PRINT_PREPARATION_FAILED",
      new Error("Printer unavailable"),
      { statusCode: 503, payload: { status: "error", message: "Printer unavailable" } },
      { payload: { error_code: "ANOTHER_ERROR" } },
    ]) {
      expect(isInvoicePrintPreparationError(error)).toBe(false);
    }
  });
});

describe("queuedDocumentPrintOutcome", () => {
  it("keeps a successful queued job on the Printer Agent route", () => {
    expect(
      queuedDocumentPrintOutcome({
        successCount: 1,
        failedCount: 0,
        pending: false,
      }),
    ).toBe("success");
  });

  it("keeps a remote queued job pending without treating it as a failure", () => {
    expect(
      queuedDocumentPrintOutcome({
        successCount: 0,
        failedCount: 0,
        pending: true,
      }),
    ).toBe("pending");
  });

  it("returns an Agent error instead of selecting a system-print fallback", () => {
    expect(
      queuedDocumentPrintOutcome({
        successCount: 0,
        failedCount: 1,
        pending: false,
      }),
    ).toBe("error");
  });

  it("treats an empty Agent response as an error", () => {
    expect(
      queuedDocumentPrintOutcome({
        successCount: 0,
        failedCount: 0,
        pending: false,
      }),
    ).toBe("error");
  });
});
