import { describe, expect, it, vi } from "vitest";
import { runKitchenConfirmation } from "./kitchen-confirmation-workflow";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => { resolve = finish; });
  return { promise, resolve };
}

describe("kitchen confirmation workflow", () => {
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
