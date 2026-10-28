import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ authenticated: vi.fn(), publicRequest: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiRequest: transport.authenticated,
  publicApiRequest: transport.publicRequest,
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500) { super(message); }
  },
}));

import {
  createSimulatorSession,
  getSimulatorBootstrap,
  getSimulatorLive,
  getSimulatorSession,
  listSimulatorSessions,
  runSimulatorAction,
  watchSimulatorSession,
  type SimulatorAction,
} from "@/services/simulator";

beforeEach(() => {
  vi.resetAllMocks();
  transport.authenticated.mockResolvedValue({ status: "success", data: { session_uuid: "session-1", version: 7 } });
});
afterEach(() => vi.unstubAllGlobals());

describe("authenticated online simulator transport", () => {
  it("reads live orders only through the authenticated read-only endpoint and passes request cancellation", async () => {
    const controller = new AbortController();
    const snapshot = { mode: "live", read_only: true, orders: [] };
    transport.authenticated.mockResolvedValueOnce({ status: "success", data: snapshot });
    await expect(getSimulatorLive("branch-1", "la", controller.signal)).resolves.toEqual(snapshot);
    expect(transport.authenticated).toHaveBeenCalledWith("get", "/api/v1/simulator/live", {
      params: { branch_uuid: "branch-1", lang: "la" }, timeout: 15_000, signal: controller.signal,
    });
    await getSimulatorBootstrap("branch-1", controller.signal);
    expect(transport.authenticated).toHaveBeenLastCalledWith("get", "/api/v1/simulator/bootstrap", {
      params: { branch_uuid: "branch-1" }, timeout: 15_000, signal: controller.signal,
    });
    expect(transport.publicRequest).not.toHaveBeenCalled();
  });

  it("propagates live read failures and rejects an empty branch without returning invented orders", async () => {
    transport.authenticated.mockRejectedValueOnce(new Error("Live data unavailable"));
    await expect(getSimulatorLive("branch-1", "en")).rejects.toThrow("Live data unavailable");
    await expect(getSimulatorLive(" ", "en")).rejects.toThrow("branch_uuid is required");
    expect(transport.authenticated).toHaveBeenCalledOnce();
  });
  it("reads branch configuration and session listings only through the authenticated simulator namespace", async () => {
    const bootstrap = { branch: { branch_uuid: "branch-1" }, catalog: [] };
    const sessions = [{ session_uuid: "session-1", version: 7 }];
    transport.authenticated.mockResolvedValueOnce({ status: "success", data: bootstrap })
      .mockResolvedValueOnce({ status: "success", data: sessions });

    await expect(getSimulatorBootstrap("branch-1")).resolves.toEqual(bootstrap);
    await expect(listSimulatorSessions("branch-1")).resolves.toEqual(sessions);
    expect(transport.authenticated.mock.calls).toEqual([
      ["get", "/api/v1/simulator/bootstrap", { params: { branch_uuid: "branch-1" }, timeout: 15_000 }],
      ["get", "/api/v1/simulator/sessions", { params: { branch_uuid: "branch-1" }, timeout: 15_000 }],
    ]);
    expect(transport.publicRequest).not.toHaveBeenCalled();
  });

  it("creates a branch-scoped session on the backend without inventing local transaction state", async () => {
    await expect(createSimulatorSession("branch-1", "Lunch training")).resolves.toEqual({ session_uuid: "session-1", version: 7 });
    expect(transport.authenticated).toHaveBeenCalledWith("post", "/api/v1/simulator/sessions", {
      data: { branch_uuid: "branch-1", name: "Lunch training" }, timeout: 15_000,
    });
    await createSimulatorSession("branch-2");
    expect(transport.authenticated).toHaveBeenLastCalledWith("post", "/api/v1/simulator/sessions", {
      data: { branch_uuid: "branch-2" }, timeout: 15_000,
    });
  });

  it.each(["pay", "confirm", "cancel_item", "split", "printer_retry", "reset", "save", "restore"] as const)(
    "routes %s through isolated simulation actions with an unchanged idempotency key and expected version",
    async (type) => {
      const action: SimulatorAction = {
        operation_uuid: "operation-1", expected_version: 6, type,
        payload: { order_uuid: "simulated-order", amount: 10000 },
      };
      await runSimulatorAction("session/with?separators", action);
      expect(transport.authenticated).toHaveBeenCalledWith("post", "/api/v1/simulator/sessions/session%2Fwith%3Fseparators/actions", {
        data: action, timeout: 15_000,
      });
      expect(transport.publicRequest).not.toHaveBeenCalled();
      expect(transport.authenticated.mock.calls.every(([, path]) => String(path).startsWith("/api/v1/simulator/"))).toBe(true);
    },
  );

  it("passes cancellation to long polling and uses a transport timeout beyond the backend wait budget", async () => {
    const controller = new AbortController();
    await watchSimulatorSession("session-1", 9, controller.signal);
    expect(transport.authenticated).toHaveBeenCalledWith("get", "/api/v1/simulator/sessions/session-1/events", {
      params: { version: 9 }, signal: controller.signal, timeout: 25_000,
    });
    await getSimulatorSession("session-1", controller.signal);
    expect(transport.authenticated).toHaveBeenLastCalledWith("get", "/api/v1/simulator/sessions/session-1", {
      signal: controller.signal, timeout: 15_000,
    });
  });

  it("propagates an aborted online request without returning a cached session", async () => {
    const controller = new AbortController();
    transport.authenticated.mockImplementationOnce((_method, _path, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("Request aborted")), { once: true });
    }));
    const request = watchSimulatorSession("session-1", 9, controller.signal);
    controller.abort();
    await expect(request).rejects.toThrow("Request aborted");
  });

  it("surfaces a failed online transaction even when the browser reports no connectivity", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    transport.authenticated.mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(runSimulatorAction("session-1", {
      operation_uuid: "payment-1", expected_version: 7, type: "pay", payload: {},
    })).rejects.toThrow("Network unavailable");
    expect(transport.authenticated).toHaveBeenCalledOnce();
  });

  it("rejects missing bootstrap and session identifiers before reaching the transport", async () => {
    await expect(getSimulatorBootstrap(" ")).rejects.toThrow("branch_uuid is required");
    await expect(getSimulatorSession("")).rejects.toThrow("session_uuid is required");
    await expect(runSimulatorAction("", {
      operation_uuid: "operation-1", expected_version: 1, type: "pause", payload: {},
    })).rejects.toThrow("session_uuid is required");
    expect(transport.authenticated).not.toHaveBeenCalled();
  });
});
