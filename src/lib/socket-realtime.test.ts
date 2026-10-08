import { afterEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ connected: true, disconnected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn() }));
vi.mock("socket.io-client", () => ({ io: () => fake }));
import { disconnectSocket, subscribeBranchTableRealtime } from "./socket";

afterEach(() => { disconnectSocket(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("branch realtime recovery", () => {
  it("subscribes a recovery refresh on reconnect and removes it on cleanup", () => {
    vi.stubGlobal("window", {});
    const change = vi.fn();
    const recover = vi.fn();
    const unsubscribe = subscribeBranchTableRealtime("branch", change, recover);
    expect(fake.on).toHaveBeenCalledWith("order_queue_changed", change);
    expect(fake.on).toHaveBeenCalledWith("connect", recover);
    const callback = fake.on.mock.calls.find(([event, handler]) => event === "connect" && handler === recover)?.[1];
    if (typeof callback !== "function") throw new Error("Missing reconnect callback");
    callback();
    expect(recover).toHaveBeenCalledOnce();
    unsubscribe();
    expect(fake.off).toHaveBeenCalledWith("connect", recover);
    expect(fake.off).toHaveBeenCalledWith("order_queue_changed", change);
  });
});
