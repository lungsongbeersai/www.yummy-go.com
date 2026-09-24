import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { classifyBackendError } from "@/lib/network-state";

describe("Backend error classification", () => {
  it.each([400, 401, 403, 404, 409, 422, 429, 500, 502, 503])(
    "classifies HTTP %s as a Backend response",
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

  it("distinguishes response-less transport failures from application errors", () => {
    const timeout = classifyBackendError(new AxiosError("timeout", "ECONNABORTED"));
    const network = classifyBackendError(new AxiosError("Network Error", "ERR_NETWORK"));
    expect(timeout).toMatchObject({
      classification: "NETWORK_TRANSPORT",
      reason: "backend_timeout",
    });
    expect(network).toMatchObject({ classification: "NETWORK_TRANSPORT" });
    expect(classifyBackendError(new Error("printer unavailable")))
      .toMatchObject({ classification: "NON_NETWORK" });
    expect(classifyBackendError(new AxiosError("bad option", "ERR_BAD_OPTION")))
      .toMatchObject({ classification: "NON_NETWORK" });
    expect(classifyBackendError(new AxiosError("canceled", "ERR_CANCELED")))
      .toMatchObject({ classification: "NON_NETWORK" });
  });
});
