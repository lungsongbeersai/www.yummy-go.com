import { describe, expect, it } from "vitest";
import {
  queuedDocumentPrintOutcome,
  queuedDocumentPrintRoute,
} from "./queued-document-print";

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

  it("uses Android system print only after the queued printer route fails", () => {
    expect(
      queuedDocumentPrintRoute(
        {
          successCount: 0,
          failedCount: 1,
          pending: false,
        },
        true,
      ),
    ).toBe("system-print");
    expect(
      queuedDocumentPrintRoute(
        {
          successCount: 1,
          failedCount: 0,
          pending: false,
        },
        true,
      ),
    ).toBe("success");
    expect(
      queuedDocumentPrintRoute(
        {
          successCount: 0,
          failedCount: 0,
          pending: true,
        },
        true,
      ),
    ).toBe("pending");
    expect(
      queuedDocumentPrintRoute(
        {
          successCount: 0,
          failedCount: 1,
          pending: false,
        },
        false,
      ),
    ).toBe("error");
    expect(
      queuedDocumentPrintRoute(
        {
          successCount: 1,
          failedCount: 1,
          pending: false,
        },
        true,
      ),
    ).toBe("error");
  });
});
