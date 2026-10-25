import { describe, expect, it, vi } from "vitest";
import type { PrintProgress } from "@/services/printer";
import {
  createKitchenPrintProgressHandler,
  runKitchenConfirmation,
} from "./kitchen-confirmation-workflow";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => { resolve = finish; });
  return { promise, resolve };
}

describe("kitchen confirmation workflow", () => {
  it("closes on the final confirmed receipt before transport settles and keeps the draft guarded through refresh", async () => {
    const transport = deferred();
    const refreshing = deferred();
    let reportProgress!: (progress: PrintProgress) => void;
    let loadingOpen = true;
    let stage: PrintProgress["phase"] | null = "printing";
    let confirmationGuarded = true;
    const onProgress = vi.fn((progress: PrintProgress) => { stage = progress.phase; });
    const closeLoading = vi.fn(() => { loadingOpen = false; stage = null; });
    const refresh = vi.fn(() => refreshing.promise);
    const release = vi.fn(() => { confirmationGuarded = false; });
    const onConfirmationError = vi.fn();
    const onRefreshError = vi.fn();
    const workflow = runKitchenConfirmation({
      confirmAndPrint: (closeLoadingOnce) => {
        reportProgress = createKitchenPrintProgressHandler({
          onProgress,
          onDeliveryComplete: closeLoadingOnce,
        });
        return transport.promise;
      },
      closeLoading,
      onConfirmationError,
      onRefreshError,
      refresh,
      release,
    });
    const delivered: PrintProgress = {
      total: 2, completed: 2, successCount: 2, failedCount: 0,
      phase: "printing", deliveryComplete: true,
    };

    try {
      reportProgress(delivered);
      expect(loadingOpen).toBe(false);
      expect(stage).toBeNull();
      expect(closeLoading).toHaveBeenCalledOnce();
      expect(confirmationGuarded).toBe(true);
      expect(refresh).not.toHaveBeenCalled();
      expect(release).not.toHaveBeenCalled();

      reportProgress({ total: 0, completed: 0, successCount: 0, failedCount: 0, phase: "fetching" });
      reportProgress(delivered);
      expect(onProgress).toHaveBeenCalledExactlyOnceWith(delivered);
      expect(stage).toBeNull();
      expect(closeLoading).toHaveBeenCalledOnce();

      transport.resolve();
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
      expect(closeLoading).toHaveBeenCalledOnce();
      expect(confirmationGuarded).toBe(true);
      expect(release).not.toHaveBeenCalled();
      refreshing.resolve();
      await workflow;
      expect(confirmationGuarded).toBe(false);
      expect(release).toHaveBeenCalledOnce();
      expect(onConfirmationError).not.toHaveBeenCalled();
      expect(onRefreshError).not.toHaveBeenCalled();
    } finally {
      transport.resolve();
      refreshing.resolve();
      await workflow;
    }
  });

  it("closes the print modal while a slow cart refresh still guards the old draft", async () => {
    const printing = deferred();
    const refreshing = deferred();
    let loadingOpen = true;
    let confirmationGuarded = true;
    const refresh = vi.fn(() => refreshing.promise);
    const onConfirmationError = vi.fn();
    const onRefreshError = vi.fn();

    const workflow = runKitchenConfirmation({
      confirmAndPrint: () => printing.promise,
      closeLoading: () => { loadingOpen = false; },
      onConfirmationError,
      onRefreshError,
      refresh,
      release: () => { confirmationGuarded = false; },
    });

    expect(loadingOpen).toBe(true);
    expect(confirmationGuarded).toBe(true);
    expect(refresh).not.toHaveBeenCalled();

    printing.resolve();
    await vi.waitFor(() => expect(loadingOpen).toBe(false));
    expect(confirmationGuarded).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();

    refreshing.resolve();
    await workflow;
    expect(confirmationGuarded).toBe(false);
    expect(onConfirmationError).not.toHaveBeenCalled();
    expect(onRefreshError).not.toHaveBeenCalled();
  });

  it("reports a refresh failure separately from an already completed confirmation", async () => {
    const refreshFailure = new Error("cart read timed out");
    const onConfirmationError = vi.fn();
    const onRefreshError = vi.fn();
    const release = vi.fn();
    let loadingOpen = true;

    await runKitchenConfirmation({
      confirmAndPrint: async () => {},
      closeLoading: () => { loadingOpen = false; },
      onConfirmationError,
      onRefreshError,
      refresh: async () => {
        expect(loadingOpen).toBe(false);
        throw refreshFailure;
      },
      release,
    });

    expect(onConfirmationError).not.toHaveBeenCalled();
    expect(onRefreshError).toHaveBeenCalledExactlyOnceWith(refreshFailure);
    expect(release).toHaveBeenCalledOnce();
  });

  it("closes loading after a confirmation failure without waiting for recovery reads", async () => {
    const confirmationFailure = new Error("confirmation request failed");
    const refreshing = deferred();
    const onConfirmationError = vi.fn();
    const onRefreshError = vi.fn();
    let loadingOpen = true;
    let confirmationGuarded = true;

    const workflow = runKitchenConfirmation({
      confirmAndPrint: async () => { throw confirmationFailure; },
      closeLoading: () => { loadingOpen = false; },
      onConfirmationError,
      onRefreshError,
      refresh: () => refreshing.promise,
      release: () => { confirmationGuarded = false; },
    });

    await vi.waitFor(() => expect(loadingOpen).toBe(false));
    expect(onConfirmationError).toHaveBeenCalledExactlyOnceWith(confirmationFailure);
    expect(confirmationGuarded).toBe(true);

    refreshing.resolve();
    await workflow;
    expect(confirmationGuarded).toBe(false);
    expect(onRefreshError).not.toHaveBeenCalled();
  });
});

describe("kitchen print progress", () => {
  it("keeps earlier order groups visible and lets only the final group close loading", () => {
    const closeLoading = vi.fn();
    const earlierProgress = vi.fn();
    const finalProgress = vi.fn();
    const earlierGroup = createKitchenPrintProgressHandler({ onProgress: earlierProgress });
    const finalGroup = createKitchenPrintProgressHandler({
      onProgress: finalProgress,
      onDeliveryComplete: closeLoading,
    });
    const delivered: PrintProgress = {
      total: 1, completed: 1, successCount: 1, failedCount: 0,
      phase: "printing", deliveryComplete: true,
    };

    earlierGroup(delivered);
    expect(earlierProgress).toHaveBeenCalledExactlyOnceWith(delivered);
    expect(closeLoading).not.toHaveBeenCalled();

    const fetching: PrintProgress = {
      total: 0, completed: 0, successCount: 0, failedCount: 0, phase: "fetching",
    };
    finalGroup(fetching);
    expect(finalProgress).toHaveBeenCalledExactlyOnceWith(fetching);
    expect(closeLoading).not.toHaveBeenCalled();
    finalGroup(delivered);
    expect(closeLoading).toHaveBeenCalledOnce();
  });

  it.each([
    ["unconfirmed delivery", { total: 2, completed: 2, successCount: 2, failedCount: 0 }],
    ["explicitly deferred delivery", { total: 2, completed: 2, successCount: 2, failedCount: 0, deliveryComplete: false }],
    ["partial delivery", { total: 2, completed: 1, successCount: 1, failedCount: 0, deliveryComplete: true }],
    ["empty work", { total: 0, completed: 0, successCount: 0, failedCount: 0, deliveryComplete: true }],
    ["a failed printer", { total: 2, completed: 2, successCount: 1, failedCount: 1, deliveryComplete: true }],
  ] satisfies [string, Omit<PrintProgress, "phase">][])("keeps loading open for %s", (_name, counts) => {
    const onProgress = vi.fn();
    const closeLoading = vi.fn();
    const reportProgress = createKitchenPrintProgressHandler({
      onProgress,
      onDeliveryComplete: closeLoading,
    });
    const progress: PrintProgress = { ...counts, phase: "printing" };

    reportProgress(progress);

    expect(onProgress).toHaveBeenCalledExactlyOnceWith(progress);
    expect(closeLoading).not.toHaveBeenCalled();
  });
});
