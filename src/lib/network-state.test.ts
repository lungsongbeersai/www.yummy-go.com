import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import {
  applyBackendReachable,
  applyBackendTransportFailure,
  BACKEND_NETWORK_STATE,
  classifyBackendError,
  initialBackendNetworkSnapshot,
  shouldUseConfirmedOfflineFallback,
} from "@/lib/network-state";

describe("Backend network state", () => {
  it("starts CHECKING and requires three transport failures before OFFLINE", () => {
    const initial = initialBackendNetworkSnapshot();
    const first = applyBackendTransportFailure(initial);
    const second = applyBackendTransportFailure(first);
    const third = applyBackendTransportFailure(second);

    expect(initial.state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(first.state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(second.state).toBe(BACKEND_NETWORK_STATE.CHECKING);
    expect(third.state).toBe(BACKEND_NETWORK_STATE.OFFLINE);
  });

  it("recovers ONLINE after one Backend response and resets failures", () => {
    const offline = applyBackendTransportFailure(
      applyBackendTransportFailure(
        applyBackendTransportFailure(initialBackendNetworkSnapshot()),
      ),
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
});
