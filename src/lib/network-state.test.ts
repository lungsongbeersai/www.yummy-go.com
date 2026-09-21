import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBackendReachable,
  applyBackendTransportFailure,
  BACKEND_NETWORK_STATE,
  classifyBackendError,
  initialBackendNetworkSnapshot,
  navigatorReportsOffline,
  shouldUseConfirmedOfflineFallback,
  SLOW_RESPONSE_THRESHOLD_MS,
} from "@/lib/network-state";

describe("Backend network state", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps cold start CHECKING even when the browser reports no network", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const offlineHint = initialBackendNetworkSnapshot();
    expect(navigatorReportsOffline()).toBe(true);
    expect(offlineHint).toMatchObject({
      state: BACKEND_NETWORK_STATE.CHECKING,
      consecutiveFailures: 0,
      lastCheckedAt: null,
    });
    expect(applyBackendTransportFailure(offlineHint, { confirmed: true }).state)
      .toBe(BACKEND_NETWORK_STATE.CHECKING);

    vi.stubGlobal("navigator", { onLine: true });
    expect(initialBackendNetworkSnapshot().state).toBe(BACKEND_NETWORK_STATE.CHECKING);
  });

  it("requires three CONFIRMED probe failures before OFFLINE", () => {
    const initial = initialBackendNetworkSnapshot();
    const first = applyBackendTransportFailure(initial, { confirmed: true });
    const second = applyBackendTransportFailure(first, { confirmed: true });
    const third = applyBackendTransportFailure(second, { confirmed: true });

    expect(initial.state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(first.state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(second.state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(third.state).toBe(BACKEND_NETWORK_STATE.OFFLINE);
  });

  it("never goes OFFLINE from unconfirmed (regular API) request failures", () => {
    let snapshot = applyBackendReachable(initialBackendNetworkSnapshot(), {
      httpStatus: 200,
    });
    expect(snapshot.state).toBe(BACKEND_NETWORK_STATE.ONLINE);

    for (let i = 0; i < 8; i += 1) {
      snapshot = applyBackendTransportFailure(snapshot, { reason: "api_blip" });
    }
    // A failed app request only asks the probe to re-verify.
    expect(snapshot.state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(snapshot.consecutiveFailures).toBe(0);
  });

  it("recovers ONLINE after one Backend response and resets failures", () => {
    const offline = applyBackendTransportFailure(
      applyBackendTransportFailure(
        applyBackendTransportFailure(initialBackendNetworkSnapshot(), {
          confirmed: true,
        }),
        { confirmed: true },
      ),
      { confirmed: true },
    );
    const online = applyBackendReachable(offline, {
      httpStatus: 200,
      reason: "backend_health_success",
    });

    expect(online).toMatchObject({
      state: BACKEND_NETWORK_STATE.ONLINE,
      consecutiveFailures: 0,
      lastHttpStatus: 200,
    });
  });

  it.each([400, 401, 403, 404, 409, 422, 429, 500, 502, 503])(
    "classifies HTTP %s as Backend reachable",
    (status) => {
      const error = new AxiosError(
        `HTTP ${status}`,
        "ERR_BAD_RESPONSE",
        undefined,
        undefined,
        {
          status,
          data: {},
          statusText: "",
          headers: {},
          config: { headers: new AxiosHeaders() },
        },
      );
      expect(classifyBackendError(error)).toMatchObject({
        classification: "HTTP_RESPONSE",
        httpStatus: status,
      });
    },
  );

  it("classifies only real response-less transport failures as network errors", () => {
    const timeout = classifyBackendError(new AxiosError("timeout", "ECONNABORTED"));
    const network = classifyBackendError(new AxiosError("Network Error", "ERR_NETWORK"));
    expect(timeout).toMatchObject({ classification: "NETWORK_TRANSPORT", reason: "backend_timeout" });
    expect(network).toMatchObject({ classification: "NETWORK_TRANSPORT" });
    expect(classifyBackendError(new Error("printer unavailable")))
      .toMatchObject({ classification: "NON_NETWORK" });
    expect(classifyBackendError(new AxiosError("bad option", "ERR_BAD_OPTION")))
      .toMatchObject({ classification: "NON_NETWORK" });
    expect(classifyBackendError(new AxiosError("canceled", "ERR_CANCELED")))
      .toMatchObject({ classification: "NON_NETWORK" });
    expect(shouldUseConfirmedOfflineFallback(network, BACKEND_NETWORK_STATE.CHECKING)).toBe(false);
    expect(shouldUseConfirmedOfflineFallback(network, BACKEND_NETWORK_STATE.ONLINE)).toBe(false);
    expect(shouldUseConfirmedOfflineFallback(network, BACKEND_NETWORK_STATE.OFFLINE)).toBe(true);
    expect(shouldUseConfirmedOfflineFallback(
      {
        classification: "HTTP_RESPONSE",
        httpStatus: 500,
        reason: "http_500_backend_reachable",
      },
      BACKEND_NETWORK_STATE.OFFLINE,
    )).toBe(false);
  });

  describe("isSlow", () => {
    it("flags ONLINE as slow when a measured probe crosses the threshold, without changing state", () => {
      const snapshot = applyBackendReachable(initialBackendNetworkSnapshot(), {
        httpStatus: 200,
        durationMs: SLOW_RESPONSE_THRESHOLD_MS,
      });
      expect(snapshot.state).toBe(BACKEND_NETWORK_STATE.ONLINE);
      expect(snapshot.isSlow).toBe(true);
    });

    it("clears isSlow once a fast probe follows a slow one", () => {
      const slow = applyBackendReachable(initialBackendNetworkSnapshot(), {
        durationMs: 3000,
      });
      const fast = applyBackendReachable(slow, { durationMs: 100 });
      expect(slow.isSlow).toBe(true);
      expect(fast.isSlow).toBe(false);
    });

    it("leaves the previous isSlow verdict untouched for calls that don't measure duration (ordinary API responses)", () => {
      const slow = applyBackendReachable(initialBackendNetworkSnapshot(), {
        durationMs: 3000,
      });
      const untouched = applyBackendReachable(slow, { httpStatus: 200 });
      expect(untouched.isSlow).toBe(true);
    });

    it("resets isSlow once OFFLINE is confirmed", () => {
      const slow = applyBackendReachable(initialBackendNetworkSnapshot(), {
        durationMs: 3000,
      });
      const offline = applyBackendTransportFailure(slow, {
        confirmed: true,
        failureThreshold: 1,
      });
      expect(offline.state).toBe(BACKEND_NETWORK_STATE.OFFLINE);
      expect(offline.isSlow).toBe(false);
    });
  });
});
