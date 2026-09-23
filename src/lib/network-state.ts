import axios from "axios";

export type BackendErrorClassification =
  | "HTTP_RESPONSE"
  | "NETWORK_TRANSPORT"
  | "NON_NETWORK";

export interface BackendErrorResult {
  classification: BackendErrorClassification;
  httpStatus: number | null;
  reason: string;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String(error.code || "").toUpperCase();
}

export function classifyBackendError(error: unknown): BackendErrorResult {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      return {
        classification: "HTTP_RESPONSE",
        httpStatus: Number(error.response.status || 0) || null,
        reason: `http_${Number(error.response.status || 0)}_backend_reachable`,
      };
    }
    const code = errorCode(error);
    if (["ECONNABORTED", "ETIMEDOUT"].includes(code)) {
      return {
        classification: "NETWORK_TRANSPORT",
        httpStatus: null,
        reason: "backend_timeout",
      };
    }
    if ([
      "ERR_NETWORK",
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "EHOSTUNREACH",
      "ENETUNREACH",
    ].includes(code)) {
      return {
        classification: "NETWORK_TRANSPORT",
        httpStatus: null,
        reason: `backend_transport_${code.toLowerCase()}`,
      };
    }
    // Axios configuration/cancellation/application errors can also have no
    // response. Only a real request plus the browser's Network Error shape is
    // allowed to affect Backend reachability.
    if (error.request && /network error|failed to fetch|load failed/i.test(error.message)) {
      return {
        classification: "NETWORK_TRANSPORT",
        httpStatus: null,
        reason: "backend_fetch_network_error",
      };
    }
    return {
      classification: "NON_NETWORK",
      httpStatus: null,
      reason: code ? `non_network_${code.toLowerCase()}` : "non_network_axios_error",
    };
  }

  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    ["AbortError", "TimeoutError"].includes(error.name)
  ) {
    return {
      classification: "NETWORK_TRANSPORT",
      httpStatus: null,
      reason: "backend_timeout",
    };
  }

  if (error instanceof TypeError && /fetch|network|failed/i.test(error.message)) {
    return {
      classification: "NETWORK_TRANSPORT",
      httpStatus: null,
      reason: "backend_fetch_network_error",
    };
  }

  return {
    classification: "NON_NETWORK",
    httpStatus: null,
    reason: "non_network_application_error",
  };
}
