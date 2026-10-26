import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSharedPrinterQueueRunner } from "./shared-printer-queue-runner";
import type { AgentInfo, PendingPrintJobRef } from "@/services/printer";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => { resolve = finish; });
  return { promise, resolve };
}

const owner: AgentInfo = {
  agent_id: "shop-agent", agent_name: "Shop owner", device_code: "SHOP-PC", platform: "win32",
};
const ref: PendingPrintJobRef = {
  print_job_uuid: "shared-job", device_code: owner.device_code,
  agent_id: owner.agent_id, remote_shared_print: true,
};

function fixture(nativeMobile = false) {
  let visible = false;
  const print = deferred<void>();
  const options = {
    nativeMobile,
    isVisible: () => visible,
    resolveOwner: vi.fn<(signal: AbortSignal) => Promise<AgentInfo | null>>().mockResolvedValue(owner),
    fetchPending: vi.fn<(agent: AgentInfo, signal: AbortSignal) => Promise<PendingPrintJobRef[]>>().mockResolvedValue([ref]),
    isLocalOwner: (job: PendingPrintJobRef, agent: AgentInfo) => job.remote_shared_print === true &&
      job.device_code === agent.device_code && job.agent_id === agent.agent_id,
    execute: vi.fn<(job: PendingPrintJobRef, agent: AgentInfo) => Promise<unknown>>().mockReturnValue(print.promise),
    onPollError: vi.fn(),
    onExecutionError: vi.fn(),
  };
  const runner = startSharedPrinterQueueRunner(options);
  return { runner, options, print, show: () => { visible = true; }, hide: () => { visible = false; } };
}

describe("shared printer owner queue scheduling", () => {
  const runners: Array<{ stop: () => void }> = [];
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    for (const runner of runners.splice(0)) runner.stop();
    vi.useRealTimers();
  });
  const start = (nativeMobile = false) => {
    const context = fixture(nativeMobile);
    runners.push(context.runner);
    return context;
  };

  it("keeps hidden desktop readiness fresh through a print longer than the 120-second presence window", async () => {
    const { runner, options } = start();
    await runner.poll();
    expect(options.execute).toHaveBeenCalledExactlyOnceWith(ref, owner);
    await vi.advanceTimersByTimeAsync(150_000);
    expect(options.fetchPending).toHaveBeenCalledTimes(6);
    expect(options.resolveOwner).toHaveBeenCalledTimes(6);
    expect(options.execute).toHaveBeenCalledTimes(1);

    const nextRef = { ...ref, print_job_uuid: "another-printer-job" };
    options.fetchPending.mockResolvedValue([ref, nextRef]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(options.execute).toHaveBeenCalledTimes(2);
    expect(options.execute).toHaveBeenLastCalledWith(nextRef, owner);
    await runner.receive(ref);
    expect(options.execute).toHaveBeenCalledTimes(2);
  });

  it("shares a pending identity read and deduplicates socket and poll delivery without waiting for paper", async () => {
    const { runner, options } = start();
    const discovery = deferred<AgentInfo | null>();
    options.resolveOwner.mockReturnValue(discovery.promise);
    const poll = runner.poll();
    const socket = runner.receive(ref);
    await vi.advanceTimersByTimeAsync(0);
    expect(options.resolveOwner).toHaveBeenCalledTimes(1);
    expect(options.fetchPending).not.toHaveBeenCalled();
    discovery.resolve(owner);
    await Promise.all([poll, socket]);
    expect(options.fetchPending).toHaveBeenCalledTimes(1);
    expect(options.execute).toHaveBeenCalledTimes(1);
  });

  it("does not refresh presence from a previous identity after the Agent becomes unreachable", async () => {
    const { runner, options } = start();
    await runner.poll();
    options.resolveOwner.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(30_000);
    await runner.receive({ ...ref, print_job_uuid: "offline-job" });
    expect(options.fetchPending).toHaveBeenCalledTimes(1);
    expect(options.execute).toHaveBeenCalledTimes(1);
    options.resolveOwner.mockResolvedValue(owner);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(options.fetchPending).toHaveBeenCalledTimes(2);
    expect(options.execute).toHaveBeenCalledTimes(1);
  });

  it("starts no new native mobile work while hidden and resumes verified polling when visible", async () => {
    const { runner, options, show, hide } = start(true);
    await runner.poll();
    await runner.receive(ref);
    await vi.advanceTimersByTimeAsync(150_000);
    expect(options.resolveOwner).not.toHaveBeenCalled();
    show();
    await runner.poll();
    expect(options.execute).toHaveBeenCalledTimes(1);
    hide();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(options.fetchPending).toHaveBeenCalledTimes(1);
    show();
    await runner.poll();
    expect(options.resolveOwner).toHaveBeenCalledTimes(2);
    expect(options.fetchPending).toHaveBeenCalledTimes(2);
    expect(options.execute).toHaveBeenCalledTimes(1);
  });

  it("coalesces a slow refs lookup and stops its late result from starting print work", async () => {
    const { runner, options } = start();
    const lookup = deferred<PendingPrintJobRef[]>();
    options.fetchPending.mockReturnValue(lookup.promise);
    const poll = runner.poll();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(options.fetchPending).toHaveBeenCalledTimes(1);
    expect(runner.poll()).toBe(poll);
    runner.stop();
    lookup.resolve([ref]);
    await poll;
    await runner.receive(ref);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(options.execute).not.toHaveBeenCalled();
    expect(options.fetchPending).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores identity discovery completing after cleanup", async () => {
    const { runner, options } = start();
    const discovery = deferred<AgentInfo | null>();
    options.resolveOwner.mockReturnValue(discovery.promise);
    const poll = runner.poll();
    const socket = runner.receive(ref);
    await vi.advanceTimersByTimeAsync(0);
    runner.stop();
    discovery.resolve(owner);
    await Promise.all([poll, socket]);
    expect(options.fetchPending).not.toHaveBeenCalled();
    expect(options.execute).not.toHaveBeenCalled();
  });

  it("does not start even a queued identity read after immediate cleanup", async () => {
    const { runner, options } = start();
    const socket = runner.receive(ref);
    runner.stop();
    await socket;
    await vi.advanceTimersByTimeAsync(0);
    expect(options.resolveOwner).not.toHaveBeenCalled();
  });

  it("keeps the next session's in-flight reservation when an old print completes", async () => {
    const previous = start();
    await previous.runner.poll();
    previous.runner.stop();
    const current = start();
    await current.runner.poll();
    previous.print.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await current.runner.receive(ref);
    await current.runner.poll();
    expect(previous.options.execute).toHaveBeenCalledTimes(1);
    expect(current.options.execute).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("does not let an old lookup completion unlock a new session's pending lookup", async () => {
    const previous = start();
    const oldLookup = deferred<PendingPrintJobRef[]>();
    previous.options.fetchPending.mockReturnValue(oldLookup.promise);
    const oldPoll = previous.runner.poll();
    await vi.advanceTimersByTimeAsync(0);
    previous.runner.stop();

    const current = start();
    const newLookup = deferred<PendingPrintJobRef[]>();
    current.options.fetchPending.mockReturnValue(newLookup.promise);
    const newPoll = current.runner.poll();
    await vi.advanceTimersByTimeAsync(0);
    oldLookup.resolve([ref]);
    await oldPoll;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(current.runner.poll()).toBe(newPoll);
    expect(current.options.fetchPending).toHaveBeenCalledTimes(1);
    expect(current.options.resolveOwner).toHaveBeenCalledTimes(1);
    expect(previous.options.execute).not.toHaveBeenCalled();
    newLookup.resolve([ref]);
    await newPoll;
    expect(current.options.execute).toHaveBeenCalledTimes(1);
  });

  it("releases a never-settling identity read and rejects its late identity after recovery", async () => {
    const { runner, options } = start();
    const oldDiscovery = deferred<AgentInfo | null>();
    const newOwner = { ...owner, agent_id: "new-agent", device_code: "NEW-PC" };
    const newRef = { ...ref, agent_id: newOwner.agent_id, device_code: newOwner.device_code };
    options.resolveOwner.mockReturnValueOnce(oldDiscovery.promise).mockResolvedValue(newOwner);
    options.fetchPending.mockResolvedValue([newRef]);
    const first = runner.poll();
    await vi.advanceTimersByTimeAsync(15_000);
    await first;
    expect(options.onPollError).toHaveBeenCalledTimes(1);
    expect(options.fetchPending).not.toHaveBeenCalled();
    await runner.poll();
    expect(options.execute).toHaveBeenCalledExactlyOnceWith(newRef, newOwner);
    oldDiscovery.resolve(owner);
    await vi.advanceTimersByTimeAsync(0);
    await runner.receive({ ...newRef, print_job_uuid: "next-new-owner-job" });
    expect(options.resolveOwner).toHaveBeenCalledTimes(2);
    expect(options.execute).toHaveBeenLastCalledWith(expect.objectContaining({ print_job_uuid: "next-new-owner-job" }), newOwner);
  });

  it("bounds a stuck refs lookup, aborts only its read and ignores late old refs", async () => {
    const { runner, options } = start();
    const oldLookup = deferred<PendingPrintJobRef[]>();
    const newRef = { ...ref, print_job_uuid: "fresh-job" };
    options.fetchPending.mockReturnValueOnce(oldLookup.promise).mockResolvedValue([newRef]);
    const first = runner.poll();
    await vi.advanceTimersByTimeAsync(0);
    const oldSignal = options.fetchPending.mock.calls[0]?.[1];
    await vi.advanceTimersByTimeAsync(45_000);
    await first;
    expect(oldSignal?.aborted).toBe(true);
    await runner.poll();
    expect(options.execute).toHaveBeenCalledExactlyOnceWith(newRef, owner);
    oldLookup.resolve([ref]);
    await vi.advanceTimersByTimeAsync(0);
    expect(options.execute).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(options.fetchPending.mock.calls.length).toBeGreaterThan(3);
    expect(options.execute).toHaveBeenCalledTimes(1);
  });

  it("checks wall time before dispatch when a buffered refs response wins the timer race after sleep", async () => {
    const { runner, options } = start();
    const oldLookup = deferred<PendingPrintJobRef[]>();
    options.fetchPending.mockReturnValueOnce(oldLookup.promise);
    const first = runner.poll();
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(Date.now() + 120_000);
    oldLookup.resolve([ref]);
    await first;
    expect(options.execute).not.toHaveBeenCalled();
    await runner.poll();
    expect(options.resolveOwner).toHaveBeenCalledTimes(2);
    expect(options.execute).toHaveBeenCalledExactlyOnceWith(ref, owner);
  });

  it.each([120_000, -3_600_000])("restarts a stale read on wake after wall-clock change %s without an old cleanup unlocking the new poll", async (change) => {
    const { runner, options } = start();
    const oldLookup = deferred<PendingPrintJobRef[]>();
    const newLookup = deferred<PendingPrintJobRef[]>();
    options.fetchPending.mockReturnValueOnce(oldLookup.promise).mockReturnValueOnce(newLookup.promise);
    const first = runner.poll();
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(Date.now() + change);
    const next = runner.poll();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    oldLookup.resolve([ref]);
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.poll()).toBe(next);
    expect(options.fetchPending).toHaveBeenCalledTimes(2);
    expect(options.execute).not.toHaveBeenCalled();
    newLookup.resolve([ref]);
    await next;
    expect(options.execute).toHaveBeenCalledExactlyOnceWith(ref, owner);
  });

  it("recovers polling after a failed lookup and filters unassigned job refs", async () => {
    const { runner, options } = start();
    options.fetchPending.mockRejectedValueOnce(new Error("Backend unavailable"));
    await runner.poll();
    expect(options.onPollError).toHaveBeenCalledTimes(1);
    expect(options.execute).not.toHaveBeenCalled();
    options.fetchPending.mockResolvedValue([
      { ...ref, device_code: "OTHER-PC" },
      { ...ref, remote_shared_print: false },
      ref,
    ]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(options.execute).toHaveBeenCalledExactlyOnceWith(ref, owner);
  });
});
