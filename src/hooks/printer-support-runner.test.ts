import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentInfo, PrinterSupportClaim, PrinterSupportExecution } from "@/services/printer";
import { printerSupportOwnerCapable, startPrinterSupportRunner } from "./printer-support-runner";
import { createSessionGuard, resetSessionStores } from "@/stores/session-store-registry";

const agent: AgentInfo = { agent_id: "agent", agent_name: "Shop", device_code: "SHOP-PC", platform: "win32", supports_printer_support: true, printer_support_protocol_version: 1 };
const claim: PrinterSupportClaim = { execution_token: "opaque-token-not-a-user-jwt", command: {
  command_uuid: "11111111-1111-4111-8111-111111111111", print_config_uuid: "22222222-2222-4222-8222-222222222222",
  action: "pin_neighbor", status: "running", created_at: "2026-11-23T08:00:00Z", expires_at: "2026-11-23T08:02:00Z", finished_at: null, result: null, error_code: null,
} };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  const options = {
    isCurrent: vi.fn(() => true),
    resolveOwner: vi.fn<(signal: AbortSignal) => Promise<AgentInfo | null>>().mockResolvedValue(agent),
    claim: vi.fn<(agent: AgentInfo, signal: AbortSignal) => Promise<PrinterSupportClaim>>().mockResolvedValue(claim),
    execute: vi.fn<(claim: PrinterSupportClaim, agent: AgentInfo, signal: AbortSignal) => Promise<PrinterSupportExecution>>().mockResolvedValue({ status: "succeeded" }),
    acknowledge: vi.fn().mockResolvedValue(undefined), onError: vi.fn(),
  };
  return { options, runner: startPrinterSupportRunner(options) };
}

describe("independent printer support receiver", () => {
  const runners: Array<ReturnType<typeof startPrinterSupportRunner>> = [];
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-23T08:00:00Z")); });
  afterEach(() => { for (const runner of runners.splice(0)) runner.stop(); vi.useRealTimers(); });
  function start() { const context = fixture(); runners.push(context.runner); return context; }

  it("requires a real supported desktop capability, including protocol version", () => {
    expect(printerSupportOwnerCapable(agent)).toBe(true);
    expect(printerSupportOwnerCapable({ ...agent, platform: "darwin" })).toBe(true);
    expect(printerSupportOwnerCapable({ ...agent, supports_printer_support: false })).toBe(false);
    expect(printerSupportOwnerCapable({ ...agent, printer_support_protocol_version: undefined })).toBe(false);
    expect(printerSupportOwnerCapable({ ...agent, platform: "browser" })).toBe(false);
  });
  it("never claims work through an old Agent or a missing local connection", async () => {
    const { runner, options } = start();
    options.resolveOwner.mockResolvedValue({ ...agent, supports_printer_support: false });
    await runner.poll();
    expect(options.claim).not.toHaveBeenCalled();
    options.resolveOwner.mockResolvedValue(null);
    await runner.poll();
    expect(options.execute).not.toHaveBeenCalled();
  });
  it("coalesces wake/poll and never repeats OS work when ACK fails or Backend returns the same claim", async () => {
    const { runner, options } = start();
    options.acknowledge.mockRejectedValue(new Error("ACK response lost"));
    const first = runner.poll();
    expect(runner.poll()).toBe(first);
    await first;
    expect(options.execute).toHaveBeenCalledTimes(1);
    expect(options.acknowledge).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15000);
    expect(options.execute).toHaveBeenCalledTimes(1);
    expect(options.acknowledge).toHaveBeenCalledTimes(1);
  });
  it("records a single uncertain outcome for an execution transport failure", async () => {
    const { runner, options } = start();
    options.execute.mockRejectedValue(new Error("POST response lost"));
    await runner.poll();
    expect(options.acknowledge).toHaveBeenCalledWith(claim, { status: "unknown", error_code: "SUPPORT_EXECUTION_UNCERTAIN" }, expect.any(AbortSignal));
    await runner.poll();
    expect(options.execute).toHaveBeenCalledTimes(1);
  });
  it("discards a slow claim after its deadline even if the transport ignores abort", async () => {
    const { runner, options } = start();
    const pending = deferred<PrinterSupportClaim>(); options.claim.mockReturnValue(pending.promise);
    const poll = runner.poll();
    await vi.advanceTimersByTimeAsync(15001);
    await poll;
    pending.resolve(claim);
    await vi.advanceTimersByTimeAsync(0);
    expect(options.execute).not.toHaveBeenCalled();
  });
  it("does not execute after unmount/logout and removes its timers", async () => {
    const { runner, options } = start();
    const pending = deferred<PrinterSupportClaim>(); options.claim.mockReturnValue(pending.promise);
    const poll = runner.poll();
    await vi.advanceTimersByTimeAsync(0);
    runner.stop(); pending.resolve(claim); await poll;
    expect(options.execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not acknowledge a Windows operation under a different login", async () => {
    const { runner, options } = start();
    const pending = deferred<PrinterSupportExecution>(); options.execute.mockReturnValue(pending.promise);
    const poll = runner.poll(); await vi.advanceTimersByTimeAsync(0);
    options.isCurrent.mockReturnValue(false);
    pending.resolve({ status: "succeeded" }); await poll;
    expect(options.acknowledge).not.toHaveBeenCalled();
  });
  it("rejects expired claims without touching the local Agent", async () => {
    const { runner, options } = start();
    options.claim.mockResolvedValue({ ...claim, command: { ...claim.command!, expires_at: "2026-11-23T07:59:00Z" } });
    await runner.poll();
    expect(options.execute).not.toHaveBeenCalled();
  });
  it("cancels an old role scope and resumes the same device only through a fresh session runner", async () => {
    const previous = start();
    previous.options.isCurrent.mockImplementation(createSessionGuard());
    const pending = deferred<PrinterSupportClaim>(); previous.options.claim.mockReturnValue(pending.promise);
    const firstPoll = previous.runner.poll(); await vi.advanceTimersByTimeAsync(0);
    // Auth validation also resets stores when the role/classification changes
    // while the login and branch identifiers remain the same.
    resetSessionStores();
    pending.resolve(claim); await firstPoll;
    expect(previous.options.execute).not.toHaveBeenCalled();
    const next = start(); next.options.isCurrent.mockImplementation(createSessionGuard());
    next.options.claim.mockResolvedValue({ ...claim, command: { ...claim.command!, command_uuid: "33333333-3333-4333-8333-333333333333" } });
    await next.runner.poll();
    expect(next.options.execute).toHaveBeenCalledTimes(1);
    await previous.runner.poll(); expect(previous.options.execute).not.toHaveBeenCalled();
  });
});
