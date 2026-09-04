import axios from "axios";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { AgentLink } from "./resolve";

// Two transports for one Agent API.
//
// Loopback keeps axios, unchanged, because that path is what every desktop
// already runs. A phone cannot use it at all: the app is an HTTPS WebView, and
// the WebView blocks plain HTTP to a LAN address as mixed content. `127.0.0.1`
// is exempt from that rule, a branch server's `192.168.x.x` is not. CapacitorHttp
// issues the request from native code, outside the WebView's network stack, so
// the mixed-content rule does not apply — the same reason TCP printing already
// goes native.

export interface AgentResponse<T> {
  status: number;
  data: T;
}

/**
 * An Agent call that did not produce a successful response.
 *
 * `responded` is the distinction the offline queue depends on: an Agent that
 * answered with an error has judged the event and it must not be retried
 * blindly, while an Agent that could not be reached says nothing about the
 * event and it stays staged.
 */
export class AgentRequestError extends Error {
  readonly responded: boolean;
  readonly status: number | null;

  constructor(message: string, options: { responded: boolean; status?: number | null }) {
    super(message);
    this.name = "AgentRequestError";
    this.responded = options.responded;
    this.status = options.status ?? null;
  }
}

/** True when the Agent answered and rejected, rather than being unreachable. */
export function agentRejected(error: unknown): boolean {
  if (error instanceof AgentRequestError) return error.responded;
  return axios.isAxiosError(error) && Boolean(error.response);
}

function bodyMessage(body: unknown): string {
  if (typeof body === "string") return body.trim();
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  for (const key of ["error", "message"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * The Agent's own reason for a rejection, which axios otherwise throws away.
 *
 * A rejected Agent call answers with `{ ok: false, error }`, but axios rejects
 * with nothing but "Request failed with status code 409" and the body never
 * reaches the till — so every offline conflict, from an unsupported route to a
 * closed bill, arrived at the cashier as the same bare status code. Keep the
 * status for the callers that branch on it, and put the Agent's sentence in the
 * message where a person reads it.
 */
export function agentResponseError(
  error: unknown,
  fallback = "Local Agent request failed",
): AgentRequestError {
  if (error instanceof AgentRequestError) return error;
  if (axios.isAxiosError(error)) {
    const response = error.response;
    if (!response) {
      return new AgentRequestError(error.message || fallback, { responded: false });
    }
    return new AgentRequestError(
      bodyMessage(response.data) || error.message || fallback,
      { responded: true, status: response.status },
    );
  }
  return new AgentRequestError(
    error instanceof Error && error.message ? error.message : fallback,
    { responded: false },
  );
}

function headersFor(link: AgentLink) {
  return {
    "Content-Type": "application/json",
    ...(link.secret ? { "x-agent-secret": link.secret } : {}),
  };
}

function nativeTransportAvailable() {
  return Capacitor.isNativePlatform();
}

export async function agentRequest<T>(
  link: AgentLink,
  input: {
    method: "GET" | "POST";
    path: string;
    data?: unknown;
    timeoutMs?: number;
  },
): Promise<AgentResponse<T>> {
  const url = `${link.baseUrl}${input.path}`;
  const timeoutMs = input.timeoutMs ?? 10000;

  if (!nativeTransportAvailable()) {
    const response = input.method === "GET"
      ? await axios.get<T>(url, { timeout: timeoutMs, headers: headersFor(link) })
      : await axios.post<T>(url, input.data ?? {}, { timeout: timeoutMs, headers: headersFor(link) });
    return { status: response.status, data: response.data };
  }

  let native: { status: number; data: unknown };
  try {
    native = await CapacitorHttp.request({
      method: input.method,
      url,
      headers: headersFor(link),
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
      ...(input.method === "POST" ? { data: input.data ?? {} } : {}),
    });
  } catch (error) {
    // Native throws only when the request never completed: no route to the host,
    // refused connection, timeout. The Agent has said nothing.
    throw new AgentRequestError(
      error instanceof Error ? error.message : "Local Agent unreachable",
      { responded: false },
    );
  }

  // CapacitorHttp resolves for every status, so a rejection has to be recognised
  // here rather than caught — otherwise a 4xx would read as a healthy reply.
  if (native.status < 200 || native.status >= 300) {
    throw new AgentRequestError(`Local Agent responded ${native.status}`, {
      responded: true,
      status: native.status,
    });
  }
  return { status: native.status, data: native.data as T };
}
