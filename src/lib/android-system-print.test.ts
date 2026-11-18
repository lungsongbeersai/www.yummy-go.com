import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  android: true, available: false, capabilityMissing: false,
  printHtml: vi.fn(), getCapabilities: vi.fn(), cancelPrint: vi.fn(),
  auth: { token: "session-one", user: { uuid: "employee-one", branch_uuid: "branch-one", store_uuid: "store-one", status: 1, store_status: 1 } },
  branch: { selectedBranchUuid: "branch-one" },
  authListeners: new Set<() => void>(), branchListeners: new Set<() => void>(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable: (name: string) => native.available && name === "AndroidSystemPrint" },
  registerPlugin: (name: string) => name === "AndroidSystemPrint" ? new Proxy({}, {
    get: (_target, property) => property === "printHtml" ? native.printHtml
      : property === "getCapabilities" ? native.capabilityMissing ? undefined : native.getCapabilities
        : property === "cancelPrint" ? native.cancelPrint : undefined,
  }) : {},
}));
vi.mock("@/lib/capacitor-platform", () => ({ isCapacitorAndroidApp: () => native.android }));
vi.mock("@/stores/auth-store", () => ({ useAuthStore: {
  getState: () => native.auth,
  subscribe: (listener: () => void) => { native.authListeners.add(listener); return () => native.authListeners.delete(listener); },
} }));
vi.mock("@/stores/branch-store", () => ({ useBranchStore: {
  getState: () => native.branch,
  subscribe: (listener: () => void) => { native.branchListeners.add(listener); return () => native.branchListeners.delete(listener); },
} }));

import { canUseAndroidSystemPrint, printHtmlWithAndroidSystemPrint } from "./android-system-print";

beforeEach(() => {
  native.android = true;
  native.available = false;
  native.capabilityMissing = false;
  native.printHtml.mockReset();
  native.getCapabilities.mockReset().mockResolvedValue({ requestCancellation: true });
  native.cancelPrint.mockReset().mockResolvedValue({ status: "cancelled" });
  native.auth.token = "session-one";
  native.branch.selectedBranchUuid = "branch-one";
  native.authListeners.clear(); native.branchListeners.clear();
  vi.stubGlobal("window", { location: { origin: "https://example.test" } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}

function viewGuard() {
  let current = true;
  const listeners = new Set<() => void>();
  const unwatch = vi.fn();
  const isCurrent = Object.assign(() => current, {
    subscribe: (invalidate: () => void) => {
      listeners.add(invalidate);
      return () => { listeners.delete(invalidate); unwatch(); };
    },
  });
  return {
    isCurrent, unwatch,
    invalidate: () => { current = false; listeners.forEach(invalidate => invalidate()); },
  };
}

function noRetainedObservers() {
  expect(native.authListeners.size).toBe(0);
  expect(native.branchListeners.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
}

describe("Android system printing capability", () => {
  it("never invokes an unimplemented bridge in an older Play shell", async () => {
    expect(canUseAndroidSystemPrint()).toBe(false);
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Own report" })).resolves.toBe(false);
    expect(native.printHtml).not.toHaveBeenCalled();
  });

  it("passes the prepared document to an available Android bridge exactly once", async () => {
    native.available = true;
    native.printHtml.mockResolvedValue(undefined);
    expect(canUseAndroidSystemPrint()).toBe(true);
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Own report" })).resolves.toBe(true);
    expect(native.printHtml).toHaveBeenCalledExactlyOnceWith({ baseUrl: "https://example.test", html: "<p>Report</p>", jobName: "Own report" });
  });

  it("does not offer the Android bridge outside the Android app", () => {
    native.android = false;
    native.available = true;
    expect(canUseAndroidSystemPrint()).toBe(false);
  });

  it("preserves the prepared report's paper orientation and color mode", async () => {
    native.available = true;
    native.printHtml.mockResolvedValue(undefined);
    await printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Sales", orientation: "landscape", colorMode: "color" });
    expect(native.printHtml).toHaveBeenCalledExactlyOnceWith({
      baseUrl: "https://example.test", html: "<p>Report</p>", jobName: "Sales", orientation: "landscape", colorMode: "color",
    });
  });

  it("propagates a failure after native printing was invoked so callers cannot duplicate the job", async () => {
    native.available = true;
    const failure = new Error("Print service unavailable");
    native.printHtml.mockRejectedValue(failure);
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Own report" })).rejects.toBe(failure);
    expect(native.printHtml).toHaveBeenCalledOnce();
  });
});

describe("guarded Android print handoff", () => {
  it("rejects an already expired view before probing or handing a document to the bridge", async () => {
    native.available = true;
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Expired", isCurrent: () => false }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(native.getCapabilities).not.toHaveBeenCalled();
    expect(native.printHtml).not.toHaveBeenCalled();
    expect(native.cancelPrint).not.toHaveBeenCalled();
  });

  it.each(["unimplemented", "missing", "unsupported"])("requires an update before guarded handoff through an older %s plugin", async condition => {
    native.available = true;
    if (condition === "unimplemented") native.getCapabilities.mockRejectedValue(Object.assign(new Error("Method unavailable"), { code: "UNIMPLEMENTED" }));
    if (condition === "missing") native.capabilityMissing = true;
    if (condition === "unsupported") native.getCapabilities.mockResolvedValue({ requestCancellation: false });
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Old shell", isCurrent: () => true }))
      .rejects.toThrow(/update/i);
    expect(native.printHtml).not.toHaveBeenCalled();
    expect(native.cancelPrint).not.toHaveBeenCalled();
  });

  it("rechecks its view after a delayed capability probe without opening a stale native print job", async () => {
    native.available = true;
    const capabilities = deferred<{ requestCancellation: true }>();
    native.getCapabilities.mockReturnValue(capabilities.promise);
    const guard = viewGuard();
    const printing = printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Delayed", isCurrent: guard.isCurrent });
    const rejected = expect(printing).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(native.getCapabilities).toHaveBeenCalledOnce());
    guard.invalidate();
    capabilities.resolve({ requestCancellation: true });
    await rejected;
    expect(native.printHtml).not.toHaveBeenCalled();
  });

  it("cancels a pending native load with the same request ID when its initiating view closes", async () => {
    vi.useFakeTimers(); native.available = true;
    const handoff = deferred<{ status: "cancelled" }>();
    const guard = viewGuard();
    native.printHtml.mockReturnValue(handoff.promise);
    native.cancelPrint.mockImplementation(async () => { handoff.resolve({ status: "cancelled" }); return { status: "cancelled" }; });
    const printing = printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Current report", isCurrent: guard.isCurrent });
    const rejected = expect(printing).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(native.printHtml).toHaveBeenCalledOnce());
    const requestId = native.printHtml.mock.calls[0][0].requestId;
    expect(requestId).toEqual(expect.any(String));
    expect(requestId.length).toBeGreaterThan(0);
    guard.invalidate();
    await rejected;
    expect(native.cancelPrint).toHaveBeenCalledExactlyOnceWith({ requestId });
    expect(guard.unwatch).toHaveBeenCalledOnce();
    noRetainedObservers();
  });

  it.each(["account", "branch"])("cancels pending native preparation immediately after a selected %s changes", async kind => {
    vi.useFakeTimers(); native.available = true;
    const handoff = deferred<{ status: "cancelled" }>();
    native.printHtml.mockReturnValue(handoff.promise);
    native.cancelPrint.mockImplementation(async () => { handoff.resolve({ status: "cancelled" }); return { status: "cancelled" }; });
    const printing = printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Owned report", isCurrent: () => true });
    const rejected = expect(printing).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(native.printHtml).toHaveBeenCalledOnce());
    if (kind === "account") { native.auth.token = "session-two"; native.authListeners.forEach(invalidate => invalidate()); }
    else { native.branch.selectedBranchUuid = "branch-two"; native.branchListeners.forEach(invalidate => invalidate()); }
    await rejected;
    expect(native.cancelPrint).toHaveBeenCalledOnce();
    noRetainedObservers();
  });

  it("polls plain guards while pending and stops polling after confirmed cancellation", async () => {
    vi.useFakeTimers(); native.available = true;
    let current = true;
    const handoff = deferred<{ status: "cancelled" }>();
    native.printHtml.mockReturnValue(handoff.promise);
    native.cancelPrint.mockImplementation(async () => { handoff.resolve({ status: "cancelled" }); return { status: "cancelled" }; });
    const printing = printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Polled report", isCurrent: () => current });
    const rejected = expect(printing).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(native.printHtml).toHaveBeenCalledOnce());
    current = false;
    await vi.advanceTimersByTimeAsync(250);
    await rejected;
    expect(native.cancelPrint).toHaveBeenCalledOnce();
    noRetainedObservers();
  });

  it("does not cancel or retry after Android has accepted the handoff", async () => {
    vi.useFakeTimers(); native.available = true;
    const guard = viewGuard();
    native.printHtml.mockResolvedValue({ status: "handed-off" });
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Accepted report", isCurrent: guard.isCurrent }))
      .resolves.toBe(true);
    guard.invalidate();
    await vi.advanceTimersByTimeAsync(1000);
    expect(native.printHtml).toHaveBeenCalledOnce();
    expect(native.cancelPrint).not.toHaveBeenCalled();
    expect(guard.unwatch).toHaveBeenCalledOnce();
    noRetainedObservers();
  });

  it("preserves a native handed-off acknowledgement when invalidation races with PrintManager acceptance", async () => {
    vi.useFakeTimers(); native.available = true;
    const handoff = deferred<{ status: "handed-off" }>();
    const guard = viewGuard();
    native.printHtml.mockReturnValue(handoff.promise);
    native.cancelPrint.mockImplementation(async () => { handoff.resolve({ status: "handed-off" }); return { status: "handed-off" }; });
    const printing = printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Race report", isCurrent: guard.isCurrent });
    await vi.waitFor(() => expect(native.printHtml).toHaveBeenCalledOnce());
    guard.invalidate();
    await expect(printing).resolves.toBe(true);
    expect(native.cancelPrint).toHaveBeenCalledOnce();
    expect(native.printHtml).toHaveBeenCalledOnce();
    noRetainedObservers();
  });

  it.each(["missing", "failure"])("does not treat a %s cancellation acknowledgement as proof that printing stopped", async outcome => {
    vi.useFakeTimers(); native.available = true;
    const handoff = deferred<{ status: "handed-off" }>();
    const guard = viewGuard();
    const settled = vi.fn();
    native.printHtml.mockReturnValue(handoff.promise);
    if (outcome === "missing") native.cancelPrint.mockResolvedValue({ status: "missing" });
    else native.cancelPrint.mockRejectedValue(new Error("Cancellation acknowledgement lost"));
    const printing = printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Unknown cancellation", isCurrent: guard.isCurrent });
    void printing.then(settled, settled);
    await vi.waitFor(() => expect(native.printHtml).toHaveBeenCalledOnce());
    guard.invalidate();
    await vi.advanceTimersByTimeAsync(250);
    expect(native.cancelPrint).toHaveBeenCalledOnce();
    expect(settled).not.toHaveBeenCalled();
    handoff.resolve({ status: "handed-off" });
    await expect(printing).resolves.toBe(true);
    expect(native.printHtml).toHaveBeenCalledOnce();
    noRetainedObservers();
  });

  it("requires an explicit handoff status from a plugin claiming cancellation support", async () => {
    vi.useFakeTimers(); native.available = true;
    native.printHtml.mockResolvedValue(undefined);
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Unknown handoff", isCurrent: () => true }))
      .rejects.toThrow(/handoff.*confirmed/i);
    expect(native.printHtml).toHaveBeenCalledOnce();
    expect(native.cancelPrint).not.toHaveBeenCalled();
    noRetainedObservers();
  });

  it("propagates an explicit native print failure without retrying or selecting another transport", async () => {
    vi.useFakeTimers(); native.available = true;
    const failure = new Error("Native print service failed before handoff");
    native.printHtml.mockRejectedValue(failure);
    await expect(printHtmlWithAndroidSystemPrint({ html: "<p>Report</p>", jobName: "Failed report", isCurrent: () => true }))
      .rejects.toBe(failure);
    expect(native.printHtml).toHaveBeenCalledOnce();
    expect(native.cancelPrint).not.toHaveBeenCalled();
    noRetainedObservers();
  });
});
