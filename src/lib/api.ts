"use client";

import axios, { AxiosError, type AxiosInstance } from "axios";
import i18n from "@/lib/i18n";
import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import { AgentRequestError } from "@/services/agent-link";
import {
  BACKEND_NETWORK_STATE,
  classifyBackendError,
  navigatorReportsOffline,
  shouldUseConfirmedOfflineFallback,
} from "@/lib/network-state";
import { shouldLogoutForUnauthorized } from "@/lib/unauthorized-session";
import {
  cacheOnlineResponse,
  browserOrderVersion,
  readBrowserOfflineCache,
  configureLocalSync,
  mirrorOnlineResponse,
  prepareOfflineRequest,
  requiresLocalOrderOwnership,
  requestBrowserWriteFallback,
  requestLocalFallback,
  shouldPreferOnlineTransport,
  shouldKeepLocalOrderOwnership,
  shouldKeepBrowserOrderOwnership,
  shouldRouteToLocal,
  shouldUseLocalPrintOwnership,
  supportsOfflineRoute,
  supportsBrowserOfflineRoute,
  withLocalPrintOwnership,
} from "@/services/offline-sync";
import { useAuthStore } from "@/stores/auth-store";
import { backendNetworkManager } from "@/stores/network-store";

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (typeof window !== "undefined" ? window.location.origin : undefined);

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public originalError?: unknown,
    // body ดิบของ response ที่ไม่ success (HTTP 200 แต่ status !== "success" ก็นับ) —
    // assertApiSuccess() เดิมทิ้งทุก field ยกเว้น status/message/code ไป ทำให้ฟิลด์
    // เสริมที่ backend แนบมากับ error response (เช่น fallback_view_only_url ของ P-72)
    // ไปไม่ถึงผู้เรียกเลย เก็บ body เต็มไว้ตรงนี้ให้ caller อ่านเองได้ตามต้องการ
    public payload?: unknown
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface RequestOptions {
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
}

function createClient(authenticated: boolean): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

  if (authenticated) {
    client.interceptors.request.use((config) => {
      const { token, isLoggedIn } = useAuthStore.getState();
      if (token && isLoggedIn) {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers["x-access-token"] = token;
      }
      if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      }
      return config;
    });

    client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status;
        const requestToken = String(
          error.config?.headers.get("x-access-token") ?? "",
        );
        const { isLoggedIn, logout, token } = useAuthStore.getState();
        if (
          !token?.startsWith("local.") &&
          shouldLogoutForUnauthorized({
            currentToken: token,
            isLoggedIn,
            requestToken,
            status,
          })
        ) {
          logout();
          if (typeof window !== "undefined") window.location.assign("/login");
        }
        return Promise.reject(error);
      }
    );
  }

  return client;
}

export const apiClient = createClient(true);
export const publicApiClient = createClient(false);

function synchronizeOfflineSessionWithBackend() {
  const networkState = backendNetworkManager.getSnapshot().state;
  const auth = useAuthStore.getState();
  if (!auth.isLoggedIn || !auth.token) return;
  if (networkState === BACKEND_NETWORK_STATE.OFFLINE) {
    if (!auth.offlineSession) auth.setOfflineSession(true);
  } else if (
    networkState === BACKEND_NETWORK_STATE.ONLINE &&
    !auth.token.startsWith("local.") &&
    auth.offlineSession
  ) {
    auth.setOfflineSession(false);
  }
}

async function send<T>(
  client: AxiosInstance,
  method: HttpMethod,
  url: string,
  options?: RequestOptions
) {
  switch (method) {
    case "get":
      return client.get<T>(url, { params: options?.params, headers: options?.headers });
    case "post":
      return client.post<T>(url, options?.data, { headers: options?.headers });
    case "put":
      return client.put<T>(url, options?.data, { headers: options?.headers });
    case "patch":
      return client.patch<T>(url, options?.data, { headers: options?.headers });
    case "delete":
      return client.delete<T>(url, {
        params: options?.params,
        data: options?.data,
        headers: options?.headers
      });
  }
}

function assertApiSuccess<T>(data: T): T {
  const maybe = data as { status?: string; message?: string; code?: number };
  if (maybe?.status && maybe.status !== "success") {
    throw new ServiceError(maybe.message ?? "Request failed", maybe.code ?? 400, undefined, data);
  }
  return data;
}

function normalizeError(error: unknown, fallback = "Request failed"): ServiceError {
  if (error instanceof ServiceError) return error;

  if (axios.isAxiosError(error)) {
    if (error.response) {
      const data = error.response.data as { message?: string };
      return new ServiceError(data?.message ?? fallback, error.response.status, error);
    }
    if (error.code === "ECONNABORTED") {
      return new ServiceError("Connection timed out", 408, error);
    }
    return new ServiceError(error.message || fallback, 0, error);
  }

  return new ServiceError(error instanceof Error ? error.message : fallback, 500, error);
}

// Only a request that never got an answer is an unreachable Agent. An Agent that
// answered has a reason, and that reason is the message — never the transport's
// "Request failed with status code 409", which tells the cashier nothing.
function localAgentUnreachable(error: unknown) {
  if (error instanceof AgentRequestError) return !error.responded;
  return axios.isAxiosError(error) && !error.response;
}

function normalizeLocalError(error: unknown): ServiceError {
  if (localAgentUnreachable(error)) {
    return new ServiceError(
      i18n.t("offlineSync.agentUnavailableDescription"),
      503,
      error,
    );
  }
  const status = error instanceof AgentRequestError ? error.status ?? 503 : 503;
  return new ServiceError(
    error instanceof Error ? error.message : "Local Agent request failed",
    status,
    error,
  );
}

export async function apiRequest<T>(
  method: HttpMethod,
  url: string,
  options?: RequestOptions,
  fallback?: string
) {
  const requestStartedAt = Date.now();
  const prepared = prepareOfflineRequest(method, url, options);
  const auth = useAuthStore.getState();
  const localScope = {
    storeUuid: auth.user?.store_uuid || auth.user?.store_uuid_fk || "",
    branchUuid: auth.user?.branch_uuid || "",
    actorLoginUuid: auth.user?.uuid || "",
  };
  const networkState = backendNetworkManager.getSnapshot().state;
  const localAgentAvailable = !isCapacitorMobileApp();
  const orderOwnershipRequired = requiresLocalOrderOwnership(method, url);
  // A terminal BLOCKED event belongs on the review page, but it cannot make the
  // online table directory display yesterday's snapshot forever. Keep the
  // stronger local-ownership rule for carts and every mutation.
  const serverAuthoritativeTableRead = method === "get" &&
    url.split("?")[0] === "/api/v1/posAll/fetch_table";
  const browserVersionAtStart = browserOrderVersion(localScope);
  const browserOwnsOrders = !localAgentAvailable && supportsOfflineRoute(method, url) &&
    (networkState === BACKEND_NETWORK_STATE.OFFLINE ||
      (!serverAuthoritativeTableRead && orderOwnershipRequired && await shouldKeepBrowserOrderOwnership(localScope, undefined, {
        keepTerminalBlocked: !serverAuthoritativeTableRead,
      })));
  if (browserOwnsOrders) {
    // A reachable server may not know this bill yet. Never let a cache miss or
    // unsupported mobile mutation fall through and overtake its queued create.
    if (!supportsBrowserOfflineRoute(method, url)) {
      throw new ServiceError(i18n.t("offlineSync.mobileOperationUnavailable"), 503);
    }
    try {
      const local = prepared.eventUuid
        ? await requestBrowserWriteFallback<T>(method, url, prepared.options, prepared.eventUuid, localScope)
        : await readBrowserOfflineCache<T>(method, url, prepared.options, localScope);
      if (local === null) throw new ServiceError(i18n.t("offlineSync.mobileCacheUnavailable"), 503);
      return assertApiSuccess(local);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(error instanceof Error ? error.message : "Offline storage failed", 503, error);
    }
  }
  // Reachability and ownership differ during reconnect: Backend may be healthy
  // while this branch's order/payment events still exist only on the Agent.
  const preferOnlineTransport = shouldPreferOnlineTransport(auth.token, networkState);
  const recoveringLocalOrders = localAgentAvailable && preferOnlineTransport &&
    !serverAuthoritativeTableRead && orderOwnershipRequired && await shouldKeepLocalOrderOwnership(localScope, undefined, {
      keepTerminalBlocked: !serverAuthoritativeTableRead,
    });
  const routeToLocal = recoveringLocalOrders || (localAgentAvailable && !preferOnlineTransport &&
    shouldRouteToLocal(
      auth.offlineSession,
      networkState,
      method,
      url,
    ));
  if (routeToLocal && !recoveringLocalOrders && !auth.offlineSession) {
    useAuthStore.getState().setOfflineSession(true);
  }
  let localConfiguration: Promise<boolean> | null = null;
  if (localAgentAvailable && auth.token && auth.user && supportsOfflineRoute(method, url)) {
    localConfiguration = routeToLocal
      ? Promise.resolve(true)
      : configureLocalSync({
        token: auth.token,
        actorLoginUuid: auth.user.uuid,
        storeUuid: auth.user.store_uuid || auth.user.store_uuid_fk || "",
        branchUuid: auth.user.branch_uuid,
      });
  }
  let requestOptions = prepared.options;
  let localOwnsPrint = false;
  if (
    localConfiguration &&
    shouldUseLocalPrintOwnership(routeToLocal, method, url)
  ) {
    localOwnsPrint = await localConfiguration;
    if (localOwnsPrint) requestOptions = withLocalPrintOwnership(requestOptions, method);
  }
  if (routeToLocal && typeof window !== "undefined") {
    try {
      const local = await requestLocalFallback<T>(
        method,
        url,
        requestOptions,
        prepared.eventUuid,
        localScope,
      );
      return assertApiSuccess(local);
    } catch (error) {
      throw normalizeLocalError(error);
    }
  }
  try {
    const response = await send<T>(apiClient, method, url, requestOptions);
    backendNetworkManager.reportReachable(response.status, "backend_api_success");
    synchronizeOfflineSessionWithBackend();
    const data = assertApiSuccess(response.data);
    if (!localAgentAvailable && orderOwnershipRequired && !prepared.eventUuid && supportsBrowserOfflineRoute(method, url) &&
        browserOrderVersion(localScope) !== browserVersionAtStart) {
      const local = await readBrowserOfflineCache<T>(method, url, requestOptions, localScope);
      if (local !== null) return assertApiSuccess(local);
      throw new ServiceError(i18n.t("offlineSync.mobileCacheUnavailable"), 503);
    }
    const currentAuth = useAuthStore.getState();
    if (
      preferOnlineTransport &&
      currentAuth.token === auth.token &&
      currentAuth.offlineSession
    ) {
      currentAuth.setOfflineSession(false);
    }
    if (localOwnsPrint) {
      try {
        await mirrorOnlineResponse(method, url, requestOptions, data, localScope);
      } catch {
        try {
          await requestLocalFallback<T>(
            method,
            url,
            requestOptions,
            prepared.eventUuid,
            localScope,
          );
        } catch (localPrintError) {
          // Backend already committed the mutation. Preserve its success response
          // so a Local Agent outage cannot make the cashier repeat a payment.
          console.error("[SYNC] local print recovery failed after online success", {
            route: `${method.toUpperCase()} ${url.split("?")[0]}`,
            message: localPrintError instanceof Error ? localPrintError.message : "Local Agent unavailable",
          });
        }
      }
    } else if (localConfiguration) {
      void localConfiguration.then(() => {
        cacheOnlineResponse(
          method,
          url,
          requestOptions,
          data,
          auth.user?.branch_uuid,
          localScope.storeUuid,
          localAgentAvailable,
          requestStartedAt,
        );
      });
    } else {
      const cached = cacheOnlineResponse(
        method,
        url,
        requestOptions,
        data,
        auth.user?.branch_uuid,
        localScope.storeUuid,
        localAgentAvailable,
        requestStartedAt,
      );
      // Capacitor's Dexie mirror is its only offline source. Finish every native
      // cache write before exposing the online response, so a transport flip
      // immediately after render cannot read the previous dashboard/table
      // snapshot. Cache failures resolve false and never fail the online call.
      if (!localAgentAvailable) await cached;
    }
    return data;
  } catch (error) {
    const classification = classifyBackendError(error);
    if (classification.classification === "HTTP_RESPONSE") {
      backendNetworkManager.reportReachable(
        classification.httpStatus,
        classification.reason,
      );
    } else if (classification.classification === "NETWORK_TRANSPORT") {
      backendNetworkManager.reportTransportFailure(classification.reason);
    }
    synchronizeOfflineSessionWithBackend();
    const normalized = normalizeError(error, fallback);
    const canContinueOffline =
      shouldUseConfirmedOfflineFallback(
        classification,
        backendNetworkManager.getSnapshot().state,
      ) ||
      // The NetworkManager may not have latched OFFLINE yet (first probe still
      // pending), but a real transport failure while the browser itself reports
      // no network is enough to serve this read from the Local Agent now.
      (classification.classification === "NETWORK_TRANSPORT" &&
        navigatorReportsOffline());
    if (
      localAgentAvailable &&
      canContinueOffline &&
      supportsOfflineRoute(method, url) &&
      typeof window !== "undefined"
    ) {
      try {
        if (localConfiguration) await localConfiguration;
        const fallbackOptions = shouldUseLocalPrintOwnership(true, method, url)
          ? withLocalPrintOwnership(requestOptions, method)
          : requestOptions;
        const local = await requestLocalFallback<T>(
          method,
          url,
          fallbackOptions,
          prepared.eventUuid,
          localScope,
        );
        useAuthStore.getState().setOfflineSession(true);
        return assertApiSuccess(local);
      } catch (localError) {
        const localFailure = normalizeLocalError(localError);
        throw new ServiceError(localFailure.message, 503, {
          onlineError: normalized,
          localError,
        });
      }
    }
    // Desktop/Electron with the Agent installed needs the same escape hatch the
    // Android branch below spells out. `canContinueOffline` waits for either the
    // latched OFFLINE verdict — three confirmed probes, so up to ~18s at a 4s
    // probe timeout and a 2s CHECKING poll — or `navigator.onLine === false`. A
    // shop whose LAN is still up while its internet is down reports `true`, so
    // for that whole window every read threw axios's raw "Network Error" at the
    // cashier instead of serving the Agent's copy.
    //
    // Reads only, and the online attempt is already spent: this cannot pre-empt a
    // live response, and it cannot duplicate a write because prepared.eventUuid
    // marks exactly the mutations that need the durable outbox and those still
    // wait for the verdict. Like the Android path it never sets offlineSession —
    // the probe stays the only authority on whether POS is offline, so one blip
    // cannot flip the app into offline mode.
    if (
      localAgentAvailable &&
      classification.classification === "NETWORK_TRANSPORT" &&
      !prepared.eventUuid &&
      supportsOfflineRoute(method, url) &&
      typeof window !== "undefined"
    ) {
      try {
        if (localConfiguration) await localConfiguration;
        const local = await requestLocalFallback<T>(
          method,
          url,
          requestOptions,
          prepared.eventUuid,
          localScope,
        );
        return assertApiSuccess(local);
      } catch {
        // The Agent is unreachable too. Fall through to the Backend error below
        // rather than replacing it with a less accurate Agent message.
      }
    }
    // Android reaches no Agent, so the Dexie mirror is its only offline source.
    //
    // This deliberately does NOT wait for `canContinueOffline`. That gate needs
    // either a latched OFFLINE verdict (three confirmed probe failures) or
    // `navigator.onLine === false` — and the Android WebView reports `true` even
    // with Wi-Fi and mobile data switched off, so the second branch never fires
    // there and every read spends the whole probe cycle showing a network error.
    //
    // Serving a cached read once the request has already failed at the transport
    // layer risks nothing the gate protects: the online attempt is spent, so this
    // cannot pre-empt a live response, and it cannot mis-route a write because
    // prepared.eventUuid is set exactly for the mutations that need a durable
    // outbox — Android has none, so those keep failing. The offline *verdict*
    // stays with the /sync/health probe: this path never sets offlineSession, so
    // one blip on a healthy network cannot flip the app into offline mode.
    if (
      !localAgentAvailable &&
      classification.classification === "NETWORK_TRANSPORT" &&
      !prepared.eventUuid &&
      supportsBrowserOfflineRoute(method, url) &&
      typeof window !== "undefined"
    ) {
      const cached = await readBrowserOfflineCache<T>(
        method,
        url,
        requestOptions,
        localScope,
      );
      if (cached !== null) return assertApiSuccess(cached);
      throw new ServiceError(i18n.t("offlineSync.mobileCacheUnavailable"), 503, normalized);
    }
    // Android write path: no Agent to hand the mutation to, so it is staged
    // into the same Dexie outbox the read branch above already replays, and
    // the response is synthesized from that state instead of thrown as a raw
    // network error. Only the 10 order-lifecycle routes `offline-order`
    // decodes (create/qty/note/discount/delete/cancel/kitchen-confirm/served/
    // payment) resolve here — requestBrowserWriteFallback returns null for
    // anything else (table move/join/split, printing), which falls through
    // to the original error unchanged, same as before this branch existed.
    // Like the read branch above, this never sets offlineSession — the
    // /sync/health probe stays the only authority on that.
    if (
      !localAgentAvailable &&
      classification.classification === "NETWORK_TRANSPORT" &&
      prepared.eventUuid &&
      typeof window !== "undefined"
    ) {
      try {
        const synthesized = await requestBrowserWriteFallback<T>(
          method,
          url,
          requestOptions,
          prepared.eventUuid,
          localScope,
        );
        if (synthesized !== null) return assertApiSuccess(synthesized);
      } catch (writeError) {
        console.error("[SYNC] mobile offline write failed", { method, url, writeError });
        throw new ServiceError(
          writeError instanceof Error ? writeError.message : "Offline write failed",
          503,
          writeError,
        );
      }
    }
    throw normalized;
  }
}

export async function publicApiRequest<T>(
  method: HttpMethod,
  url: string,
  options?: RequestOptions,
  fallback?: string
) {
  try {
    const response = await send<T>(publicApiClient, method, url, options);
    backendNetworkManager.reportReachable(response.status, "backend_public_api_success");
    synchronizeOfflineSessionWithBackend();
    return assertApiSuccess(response.data);
  } catch (error) {
    const classification = classifyBackendError(error);
    if (classification.classification === "HTTP_RESPONSE") {
      backendNetworkManager.reportReachable(
        classification.httpStatus,
        classification.reason,
      );
    } else if (classification.classification === "NETWORK_TRANSPORT") {
      backendNetworkManager.reportTransportFailure(classification.reason);
    }
    synchronizeOfflineSessionWithBackend();
    throw normalizeError(error, fallback);
  }
}
