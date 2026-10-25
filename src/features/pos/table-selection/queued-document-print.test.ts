import { describe, expect, it, vi } from "vitest";
import {
  createCheckoutDocumentActionGuard,
  committedReceiptOrderUuid,
  createCommittedReceiptRetry,
  documentPrinterFailureKind,
  type QueuedDocumentPrintOutcome,
  finishCommittedPayment,
  isInvoicePrintPreparationError,
  queuedDocumentPrintOutcome,
  queuedDocumentPrintFailureMessage,
} from "./queued-document-print";

describe("document printer availability errors", () => {
  it.each([
    { payload: { error_code: "DOCUMENT_PRINTER_UNAVAILABLE", role_code: "invoice", retryable: true } },
    { payment_committed: true, print_queue_error: { error_code: "DOCUMENT_PRINTER_UNAVAILABLE", role_code: "receipt" } },
    new Error("DOCUMENT_PRINTER_UNAVAILABLE: receipt is unreachable"),
    "no active printer config for role_code invoice",
  ])("recognizes the exact unavailable-printer contract without changing a committed payment: %j", (failure) => {
    expect(documentPrinterFailureKind(failure)).toBe("unavailable");
  });
  it("distinguishes authorization and registration from an unavailable document route", () => {
    expect(documentPrinterFailureKind({ payload: { error_code: "PRINTER_AGENT_AUTHORIZATION_FAILED" } })).toBe("authorization");
    expect(documentPrinterFailureKind({ payload: { error_code: "PRINTER_AGENT_REGISTRATION_FAILED" } })).toBe("registration");
    expect(documentPrinterFailureKind(new Error("Printer paper out"))).toBeNull();
    expect(documentPrinterFailureKind({ payload: { error_code: "INVOICE_PRINT_PREPARATION_FAILED" } })).toBeNull();
  });
});

function deferred() {
  let resolve: (outcome?: QueuedDocumentPrintOutcome) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<QueuedDocumentPrintOutcome>((resolvePromise, rejectPromise) => {
    resolve = (outcome = "success") => resolvePromise(outcome);
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
  it.each(["pending", "error"] as const)(
    "preserves a %s receipt result when completing an already committed payment",
    async (printOutcome) => {
      const onCommitted = vi.fn();
      const refresh = vi.fn(async () => {});
      const onPrintError = vi.fn();
      const result = await finishCommittedPayment({
        print: async () => printOutcome,
        onCommitted,
        refresh,
        onPrintError,
      });

      expect(result.printOutcome).toBe(printOutcome);
      expect(onCommitted).toHaveBeenCalledExactlyOnceWith(printOutcome);
      expect(refresh).toHaveBeenCalledOnce();
      expect(onPrintError).not.toHaveBeenCalled();
    },
  );

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
    expect(result).toEqual({ printOutcome: "success" });
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
    const result = await finishCommittedPayment({
      print: () => { throw failure; },
      onCommitted: close,
      refresh,
      onPrintError,
    });
    expect(onPrintError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(result.printOutcome).toBe("error");
    expect(result.printError).toBe(failure);
    expect(close).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps a close-dialog error separate from payment failure and still refreshes orders", async () => {
    const failure = new Error("Dialog completion failed");
    const refresh = vi.fn(async () => {});
    const print = vi.fn(async () => "success" as const);
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

describe("committedReceiptOrderUuid", () => {
  it("uses the order attached to the committed payment instead of the displayed table order", () => {
    expect(committedReceiptOrderUuid({
      order_uuid: "table-order",
      new_order: { order_uuid: "split-order" },
      payment: { order_uuid_fk: "paid-order" },
    }, "current-table-order")).toBe("paid-order");
  });

  it("reprints a paid split bill using its child order rather than the remaining source bill", () => {
    expect(committedReceiptOrderUuid({
      order_uuid: "source-order",
      new_order: { order_uuid: "paid-split-order" },
    }, "generated-paid-split-order", true)).toBe("paid-split-order");
    expect(committedReceiptOrderUuid({
      data: { new_order: { order_uuid: "paid-split-order" } },
    }, "generated-paid-split-order")).toBe("paid-split-order");
    expect(committedReceiptOrderUuid({
      order_uuid: "source-order",
    }, "generated-paid-split-order", true)).toBe("generated-paid-split-order");
  });

  it("retains the captured committed identity when the response contains no order details", () => {
    expect(committedReceiptOrderUuid({}, "original-paid-order")).toBe("original-paid-order");
  });
});

describe("queued document preparation errors", () => {
  it("surfaces the authoritative printer routing error instead of a generic missing-job message", () => {
    expect(queuedDocumentPrintFailureMessage({
      print_queue_error: { message: "No active printer config for role invoice" },
      fallback_print: { reason: "Fallback printer unavailable" },
    }, "No print job")).toBe("No active printer config for role invoice");
  });

  it("preserves the backend fallback reason for invoice and split preview requests", () => {
    expect(queuedDocumentPrintFailureMessage({
      fallback_print: { reason: "Shared invoice printer is not ready" },
    }, "No print job")).toBe("Shared invoice printer is not ready");
  });

  it("uses the missing-job message only when backend supplied no usable reason", () => {
    expect(queuedDocumentPrintFailureMessage({
      print_queue_error: { message: "  " },
      fallback_print: { reason: false },
    }, "No print job")).toBe("No print job");
  });
});

describe("committed receipt recovery", () => {
  it("prints only the captured paid order/payment and retains the Shared owner query across retries", async () => {
    const receipt = {
      order_uuid: "paid-split-order",
      payment_uuid: "committed-payment",
      login_uuid_fk: "original-cashier",
      lang: "la",
      show_logo: false,
    };
    const sharedQuery = {
      print_job_uuid: "recovered-receipt-job",
      device_code: "shared-owner",
      login_uuid_fk: "original-cashier",
      remote_shared_print: true,
    };
    const requestReceipt = vi.fn(async () => sharedQuery);
    const execute = vi.fn(async () => "pending" as const);
    const recovery = createCommittedReceiptRetry({
      receipt,
      requestReceipt,
      execute,
      createOperationUuid: () => "receipt-operation",
      missingJobMessage: "No receipt job",
    });

    // A different bill can become visible before the cashier retries printing.
    receipt.order_uuid = "next-unpaid-order";
    receipt.payment_uuid = "different-payment";
    expect(await recovery.retry(false)).toBe("pending");
    expect(await recovery.retry(false)).toBe("pending");
    expect(requestReceipt).toHaveBeenCalledExactlyOnceWith({
      order_uuid: "paid-split-order",
      payment_uuid: "committed-payment",
      login_uuid_fk: "original-cashier",
      lang: "la",
      show_logo: false,
      operation_uuid: "receipt-operation",
    });
    expect(execute).toHaveBeenNthCalledWith(1, sharedQuery);
    expect(execute).toHaveBeenNthCalledWith(2, sharedQuery);
  });

  it("reuses the operation UUID after an uncertain enqueue response instead of creating duplicate receipts", async () => {
    const failure = new Error("Response interrupted");
    const query = { print_job_uuid: "same-recovered-job", login_uuid_fk: "cashier" };
    const requestReceipt = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(query);
    const operation = vi.fn(() => "stable-receipt-operation");
    const execute = vi.fn(async () => "success" as const);
    const recovery = createCommittedReceiptRetry({
      receipt: { order_uuid: "paid-order", login_uuid_fk: "cashier" },
      requestReceipt,
      execute,
      createOperationUuid: operation,
      missingJobMessage: "No receipt job",
    });

    await expect(recovery.retry()).rejects.toBe(failure);
    await expect(recovery.retry()).resolves.toBe("success");
    expect(operation).toHaveBeenCalledOnce();
    expect(requestReceipt.mock.calls[0]).toEqual(requestReceipt.mock.calls[1]);
    expect(execute).toHaveBeenCalledExactlyOnceWith(query);
  });

  it("creates a fresh receipt-only job only after an explicit new print round", async () => {
    const requestReceipt = vi.fn()
      .mockResolvedValueOnce({ print_job_uuid: "failed-receipt-job" })
      .mockResolvedValueOnce({ print_job_uuid: "retry-receipt-job" });
    const execute = vi.fn()
      .mockResolvedValueOnce("error")
      .mockResolvedValueOnce("success");
    const operation = vi.fn()
      .mockReturnValueOnce("first-operation")
      .mockReturnValueOnce("explicit-retry-operation");
    const recovery = createCommittedReceiptRetry({
      receipt: { order_uuid: "paid-order", payment_uuid: "paid-once", login_uuid_fk: "cashier" },
      requestReceipt,
      execute,
      createOperationUuid: operation,
      missingJobMessage: "No receipt job",
    });

    await expect(recovery.retry()).resolves.toBe("error");
    await expect(recovery.retry(true)).resolves.toBe("success");
    expect(requestReceipt).toHaveBeenNthCalledWith(2, {
      order_uuid: "paid-order",
      payment_uuid: "paid-once",
      login_uuid_fk: "cashier",
      operation_uuid: "explicit-retry-operation",
    });
    expect(execute).toHaveBeenNthCalledWith(2, { print_job_uuid: "retry-receipt-job" });
  });

  it("defaults each explicit manual receipt reprint to a new job without replaying payment", async () => {
    const requestReceipt = vi.fn()
      .mockResolvedValueOnce({ print_job_uuid: "old-failed-receipt" })
      .mockResolvedValueOnce({ print_job_uuid: "manual-new-receipt" });
    const execute = vi.fn().mockResolvedValue("error");
    const recovery = createCommittedReceiptRetry({
      receipt: { order_uuid: "paid-order", payment_uuid: "same-payment", login_uuid_fk: "cashier" },
      requestReceipt,
      execute,
      createOperationUuid: vi.fn().mockReturnValueOnce("original-operation").mockReturnValueOnce("manual-operation"),
      missingJobMessage: "No receipt job",
    });
    await recovery.retry();
    await recovery.retry();
    expect(requestReceipt.mock.calls.map(([request]) => request.operation_uuid)).toEqual([
      "original-operation", "manual-operation",
    ]);
    expect(requestReceipt.mock.calls.every(([request]) => request.payment_uuid === "same-payment")).toBe(true);
    expect(execute).toHaveBeenNthCalledWith(2, { print_job_uuid: "manual-new-receipt" });
  });

  it("keeps missing receipt jobs as recoverable errors and never reports print success", async () => {
    const execute = vi.fn(async () => "success" as const);
    const recovery = createCommittedReceiptRetry({
      receipt: { order_uuid: "paid-order", login_uuid_fk: "cashier" },
      requestReceipt: async () => null,
      execute,
      createOperationUuid: () => "receipt-operation",
      missingJobMessage: "No active receipt printer",
    });
    await expect(recovery.retry()).rejects.toThrow("No active receipt printer");
    expect(execute).not.toHaveBeenCalled();
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

  it("does not claim receipt success when only some expected documents were printed", () => {
    expect(queuedDocumentPrintOutcome({
      successCount: 1,
      failedCount: 0,
      total: 2,
    })).toBe("error");
    expect(queuedDocumentPrintOutcome({
      successCount: 1,
      failedCount: 0,
      total: 1,
      errorMessage: "Receipt delivery was incomplete",
    })).toBe("error");
  });

  it("requires manual action for uncertain delivery instead of showing an endlessly queued receipt", () => {
    expect(queuedDocumentPrintOutcome({
      successCount: 0, failedCount: 0, pending: true,
      errorMessage: "Delivery is uncertain; create a fresh manual print",
    })).toBe("error");
  });
});
