import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { monitorPrinterAgentConnection } from "./printer-agent-monitor";

describe("printer Agent connection monitoring", () => {
  let browser: EventTarget;
  let page: EventTarget & { visibilityState: string };
  let stop: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    browser = Object.assign(new EventTarget(), { setInterval, clearInterval });
    page = Object.assign(new EventTarget(), { visibilityState: "visible" });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("document", page);
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("coalesces wake events while checking and throttles a subsequent burst", async () => {
    let complete!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    const monitor = monitorPrinterAgentConnection(refresh);
    stop = monitor.stop;
    browser.dispatchEvent(new Event("focus"));
    browser.dispatchEvent(new Event("online"));
    page.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    const running = monitor.refresh();
    complete();
    await running;
    browser.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    const second = monitor.refresh();
    complete();
    await second;
    browser.dispatchEvent(new Event("online"));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("checks visible idle pages, skips background pages and cleans up every listener", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const monitor = monitorPrinterAgentConnection(refresh);
    stop = monitor.stop;
    await vi.advanceTimersByTimeAsync(30000);
    expect(refresh).toHaveBeenCalledTimes(1);
    page.visibilityState = "hidden";
    browser.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(30000);
    expect(refresh).toHaveBeenCalledTimes(1);
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    monitor.stop();
    await vi.advanceTimersByTimeAsync(60000);
    browser.dispatchEvent(new Event("online"));
    page.dispatchEvent(new Event("visibilitychange"));
    await monitor.refresh();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("allows a later recovery check after a failed read", async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error("Agent restarting")).mockResolvedValue(undefined);
    const monitor = monitorPrinterAgentConnection(refresh);
    stop = monitor.stop;
    await monitor.refresh();
    await vi.advanceTimersByTimeAsync(3000);
    await monitor.refresh();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("checks again after a backward wall-clock correction instead of throttling for the full shift", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const monitor = monitorPrinterAgentConnection(refresh);
    stop = monitor.stop;
    await monitor.refresh();
    vi.setSystemTime(Date.now() - 3_600_000);
    await monitor.refresh();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not start a queued read after the page unmounts", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const monitor = monitorPrinterAgentConnection(refresh);
    stop = monitor.stop;
    browser.dispatchEvent(new Event("focus"));
    monitor.stop();
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();
  });
});
