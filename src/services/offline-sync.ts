"use client";

import axios from "axios";
import {
  BACKEND_NETWORK_STATE,
  type BackendNetworkState,
} from "@/lib/network-state";
import { AGENT_URL } from "@/config/printer-agent";
import type { HttpMethod, RequestOptions } from "@/lib/api";
import {
  browserSyncQueueHasRetryableWork,
  cacheBrowserApiResponse,
  discardBrowserSyncEvent,
  getBrowserSyncQueueSummary,
  listBrowserSyncQueue,
  noteBrowserMutation,
  persistBrowserSyncStatus,
  readBrowserApiFallback,
  stageBrowserSyncRequest,
  updateBrowserSyncEvent,
  type BrowserOfflineIdentity,
  type BrowserOfflineScope,
  type BrowserOfflineStore,
  type BrowserSyncEventStatus,
  type BrowserSyncQueueEntry,
  type BrowserSyncQueueSummary,
} from "@/services/offline-db";

const OFFLINE_ROUTES = new Set([
  "POST /api/v1/posAll/create_order",
  "PATCH /api/v1/posAll/order_item/update_qty",
  "PATCH /api/v1/posAll/item_discount",
  "PATCH /api/v1/posAll/bill_discount",
  "PATCH /api/v1/posAll/update_note",
  "DELETE /api/v1/posAll/delete_order_item",
  "PATCH /api/v1/posAll/confirm_to_kitchen",
  "PATCH /api/v1/posAll/customer_order_queue/send_to_kitchen",
  "PATCH /api/v1/posAll/confirm_order_item_served",
  "PATCH /api/v1/posAll/cancel_order_item",
  "POST /api/v1/posAll/move_table",
  "POST /api/v1/posAll/join_table_multi",
  "POST /api/v1/posAll/split_bill",
  "POST /api/v1/posAll/print_invoice",
  "POST /api/v1/posAll/reprint_receipt",
  "POST /api/v1/posAll/payment",
  "GET /api/v1/posAll/admin/create_table_qr",
]);

const OFFLINE_GET_ROUTES = new Set([
  "/api/v1/posAll/fetch_table",
  "/api/v1/posAll/fetch_cate_products",
  "/api/v1/posAll/fetch_cart",
  "/api/v1/posAll/fetch_join_move_table",
  "/api/v1/posAll/admin/create_table_qr",
  "/api/v1/posAll/customer_order_queue",
  "/api/v1/exchange/fetch_all",
  "/api/v1/currency/fetch_all",
  "/api/v1/customer/list",
  "/api/v1/printer/fetch",
  "/api/v1/printer/fetch_all",
  "/api/v1/branch/fetch_limit",
  "/api/v1/branch/fetch_all",
  "/api/v1/groups/fetch_limit",
  "/api/v1/groups/fetch_all",
  "/api/v1/category/fetch_limit",
  "/api/v1/unite/fetch_limit",
  "/api/v1/unite/fetch_all",
  "/api/v1/sizes/fetch_limit",
  "/api/v1/sizes/fetch_all",
  "/api/v1/topping/fetch_limit",
  "/api/v1/topping/fetch_all",
  "/api/v1/colors/fetch_limit",
  "/api/v1/status/fetch_all",
  "/api/v1/product/fetch_limit",
  "/api/v1/product/stock_qty",
  "/api/v1/register/fetch_limit",
  "/api/v1/report/sale_report",
  "/api/v1/report_all/sale_report_bill",
  "/api/v1/report_all/sale_report_list",
  "/api/v1/report_all/sale_list",
  "/api/v1/report_all/payment_summary_by_method",
  "/api/v1/report_all/group_list",
  "/api/v1/report_all/daily_closing",
  "/api/v1/best_selling/best_selling_products",
  "/api/v1/dashboard/executive",
]);

const LOCAL_READ_ROUTES = new Set([
  "POST /api/v1/posAll/get_prod_item",
  "POST /api/v1/posAll/init_order_without_table",
  "POST /api/v1/status/fetch_size",
]);

const LOCAL_PRINT_OWNER_ROUTES = new Set([
  "PATCH /api/v1/posAll/confirm_to_kitchen",
  "POST /api/v1/posAll/print_invoice",
  "POST /api/v1/posAll/payment",
  "GET /api/v1/posAll/admin/create_table_qr",
]);

export interface LocalSyncIdentity {
  token: string;
  actorLoginUuid: string;
  storeUuid: string;
  branchUuid: string;
}

export interface OfflineSessionInput extends LocalSyncIdentity {
  loginEmail: string;
  loginPassword: string;
  loginResponse: {
    loginEmail: string;
    loginStatus: number;
    loginProfile: string;
    branchName: string;
    branchTel: string;
    branchAddress: string;
    storeName: string;
    storeLogo: string;
    storeTableStatus: number;
  };
}

export interface LocalSyncStatus {
  bootstrap_complete: boolean;
  configured?: boolean;
  connection_state?: "DEGRADED" | "OFFLINE" | "ONLINE" | "SYNCING";
  consecutive_failures?: number;
  store_uuid?: string | null;
  branch_uuid?: string | null;
  actor_login_uuid?: string | null;
  pending?: {
    pending?: number;
    processing?: number;
    failed?: number;
    blocked?: number;
  };
}

interface LocalAgentResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface LocalSyncEvent {
  event_uuid: string;
  dependencies?: string[];
  sync_status?: Exclude<BrowserSyncEventStatus, "STAGED">;
  last_error?: string | null;
}

interface PreparedOfflineRequest {
  eventUuid: string | null;
  options: RequestOptions | undefined;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...value as Record<string, unknown> }
    : {};
}

function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function routeKey(method: HttpMethod, url: string) {
  return `${method.toUpperCase()} ${url.split("?")[0]}`;
}

function requestParams(url: string, params: Record<string, unknown> | undefined) {
  const combined: Record<string, unknown> = { ...(params ?? {}) };
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  for (const [key, value] of new URLSearchParams(query).entries()) {
    const current = combined[key];
    if (current === undefined) combined[key] = value;
    else if (Array.isArray(current)) combined[key] = [...current, value];
    else combined[key] = [current, value];
  }
  return combined;
}

function isLocalOnlyPrintRoute(method: string, url: string) {
  return `${method.toUpperCase()} ${url.split("?")[0]}` ===
    "POST /api/v1/posAll/reprint_receipt";
}

function isBrowserCacheableRead(method: HttpMethod, url: string) {
  return (method === "get" && OFFLINE_GET_ROUTES.has(url.split("?")[0])) ||
    LOCAL_READ_ROUTES.has(routeKey(method, url));
}

function localEventStatus(value: unknown): Exclude<BrowserSyncEventStatus, "STAGED"> {
  const status = String(value || "").toUpperCase();
  if (["PENDING", "PROCESSING", "FAILED", "BLOCKED", "SYNCED"].includes(status)) {
    return status as Exclude<BrowserSyncEventStatus, "STAGED">;
  }
  return "PENDING";
}

export function supportsOfflineRoute(method: HttpMethod, url: string) {
  return (method === "get" && OFFLINE_GET_ROUTES.has(url.split("?")[0])) ||
    OFFLINE_ROUTES.has(routeKey(method, url)) ||
    LOCAL_READ_ROUTES.has(routeKey(method, url));
}

export function shouldPreferOnlineTransport(
  token: string | null | undefined,
  networkState: BackendNetworkState,
) {
  return networkState !== BACKEND_NETWORK_STATE.OFFLINE &&
    !token?.startsWith("local.");
}

export function shouldRouteToLocal(
  offlineSession: boolean,
  networkState: BackendNetworkState,
  method: HttpMethod,
  url: string,
) {
  return supportsOfflineRoute(method, url) &&
    (offlineSession || networkState === BACKEND_NETWORK_STATE.OFFLINE);
}

export function needsLocalPrintOwnership(method: HttpMethod, url: string) {
  return LOCAL_PRINT_OWNER_ROUTES.has(routeKey(method, url));
}

export function shouldUseLocalPrintOwnership(
  offlineSession: boolean,
  method: HttpMethod,
  url: string,
) {
  // Online requests must keep the Backend-owned print job because it contains
  // the established receipt/kitchen template. The Agent builds a fallback
  // document only after the session has actually switched offline.
  return offlineSession && needsLocalPrintOwnership(method, url);
}

export function withLocalPrintOwnership(
  options: RequestOptions | undefined,
  method: HttpMethod = "post",
): RequestOptions {
  if (method === "get") {
    return {
      ...options,
      params: { ...record(options?.params), local_agent_print: true },
    };
  }
  return {
    ...options,
    data: { ...record(options?.data), local_agent_print: true },
  };
}

export function prepareOfflineRequest(
  method: HttpMethod,
  url: string,
  options?: RequestOptions,
): PreparedOfflineRequest {
  if (!OFFLINE_ROUTES.has(routeKey(method, url))) return { eventUuid: null, options };
  const data = record(options?.data);
  const eventUuid = String(data.sync_event_uuid || uuid());
  data.sync_event_uuid = eventUuid;

  if (routeKey(method, url) === "POST /api/v1/posAll/create_order") {
    data.order_uuid = String(data.order_uuid || uuid());
    data.items = Array.isArray(data.items)
      ? data.items.map((rawItem) => {
        const item = record(rawItem);
        return {
          ...item,
          order_it_uuid: String(item.order_it_uuid || item.order_item_uuid || uuid()),
          stock_event_uuid: String(item.stock_event_uuid || uuid()),
        };
      })
      : [];
  }
  if (routeKey(method, url) === "POST /api/v1/posAll/payment") {
    data.payment_uuid = String(data.payment_uuid || uuid());
  }
  if (routeKey(method, url) === "POST /api/v1/posAll/split_bill") {
    const newOrderUuid = String(data.new_order_uuid || uuid());
    data.new_order_uuid = newOrderUuid;
    data.payment_uuid = String(data.payment_uuid || uuid());
    const requestedItems = Array.isArray(data.order_item_uuids) ? data.order_item_uuids : [];
    const existingMap = record(data.split_item_uuid_map);
    data.split_item_uuid_map = Object.fromEntries(
      requestedItems.flatMap((rawItem) => {
        const item = record(rawItem);
        return Object.keys(item).map((sourceUuid) => [
          sourceUuid,
          String(existingMap[sourceUuid] || uuid()),
        ]);
      }),
    );
  }
  if ([
    "PATCH /api/v1/posAll/order_item/update_qty",
    "DELETE /api/v1/posAll/delete_order_item",
    "PATCH /api/v1/posAll/cancel_order_item",
  ].includes(routeKey(method, url))) {
    data.stock_event_uuid = String(data.stock_event_uuid || uuid());
  }
  if (routeKey(method, url) === "PATCH /api/v1/posAll/cancel_order_item") {
    data.cancelled_order_item_uuid = String(data.cancelled_order_item_uuid || uuid());
  }

  return {
    eventUuid,
    options: {
      ...options,
      data,
      headers: {
        ...options?.headers,
        "x-sync-event-uuid": eventUuid,
      },
    },
  };
}

function onlineApiBase() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
}

let configureKey = "";
let configurePromise: Promise<boolean> | null = null;
let localStatusCache: { checkedAt: number; status: LocalSyncStatus } | null = null;
let localStatusPromise: Promise<LocalSyncStatus | null> | null = null;

function clearFailedConfiguration(expectedKey: string) {
  if (configureKey !== expectedKey) return;
  configureKey = "";
  configurePromise = null;
}

export function configureLocalSync(identity: LocalSyncIdentity): Promise<boolean> {
  if (typeof window === "undefined" || !identity.token || !identity.actorLoginUuid) return Promise.resolve(false);
  const nextKey = `${identity.branchUuid}:${identity.actorLoginUuid}:${identity.token.slice(-12)}`;
  if (configureKey === nextKey && configurePromise) return configurePromise;
  configureKey = nextKey;
  configurePromise = (async () => {
    const localSession = identity.token.startsWith("local.");
    if (localSession || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      try {
        const status = await axios.get<LocalAgentResponse<LocalSyncStatus>>(
          `${AGENT_URL}/local/sync/status`,
          { timeout: 1500 },
        );
        const local = status.data.data;
        if (
          status.data.ok && local?.configured &&
          local.store_uuid === identity.storeUuid &&
          local.branch_uuid === identity.branchUuid &&
          local.actor_login_uuid === identity.actorLoginUuid
        ) return true;
      } catch {
        // A normal online token can still configure below after a temporary status failure.
      }
      // Local tokens are intentionally rejected by Backend JWT verification. Reuse only
      // the already configured matching scope until the Agent restores an online session.
      if (localSession) return false;
    }
    const response = await axios.post<LocalAgentResponse<unknown>>(
      `${AGENT_URL}/local/sync/configure`,
      {
        online_api_base: onlineApiBase(),
        access_token: identity.token,
        actor_login_uuid: identity.actorLoginUuid,
        store_uuid: identity.storeUuid,
        branch_uuid: identity.branchUuid,
      },
      { timeout: 2000 },
    );
    return response.data.ok === true;
  })().then((configured) => {
    if (!configured) clearFailedConfiguration(nextKey);
    return configured;
  }).catch(() => {
    clearFailedConfiguration(nextKey);
    return false;
  });
  return configurePromise;
}

export async function getLocalSyncStatus({
  force = false,
  maxAgeMs = 1000,
  timeoutMs = 1000,
}: {
  force?: boolean;
  maxAgeMs?: number;
  timeoutMs?: number;
} = {}): Promise<LocalSyncStatus | null> {
  if (typeof window === "undefined") return null;
  if (!force && localStatusCache && Date.now() - localStatusCache.checkedAt <= maxAgeMs) {
    return localStatusCache.status;
  }
  if (localStatusPromise) return localStatusPromise;
  localStatusPromise = axios.get<LocalAgentResponse<LocalSyncStatus>>(
    `${AGENT_URL}/local/sync/status`,
    { timeout: timeoutMs },
  ).then((response) => {
    if (!response.data.ok || !response.data.data) return null;
    localStatusCache = { checkedAt: Date.now(), status: response.data.data };
    void mirrorBrowserSyncStatus(response.data.data).catch(() => undefined);
    return response.data.data;
  }).catch(() => null).finally(() => {
    localStatusPromise = null;
  });
  return localStatusPromise;
}

export function localSyncHasRetryableWork(status: LocalSyncStatus | null) {
  const pending = status?.pending;
  return Number(pending?.pending || 0) > 0 ||
    Number(pending?.processing || 0) > 0 ||
    Number(pending?.failed || 0) > 0;
}

export async function runLocalSyncNow(): Promise<LocalSyncStatus | null> {
  if (typeof window === "undefined") return null;
  localStatusCache = null;
  try {
    const response = await axios.post<LocalAgentResponse<unknown>>(
      `${AGENT_URL}/local/sync/run`,
      {},
      { timeout: 40000 },
    );
    if (!response.data.ok) return null;
  } catch {
    return null;
  }
  return getLocalSyncStatus({ force: true, timeoutMs: 1500 });
}

async function waitForLocalBootstrap(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await axios.get<LocalAgentResponse<LocalSyncStatus>>(
        `${AGENT_URL}/local/sync/status`,
        { timeout: 3000 },
      );
      if (response.data.ok && response.data.data?.bootstrap_complete === true) return true;
    } catch {
      // Agent may still be starting its first bootstrap page. Poll until the deadline.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  return false;
}

async function warmOfflineRoutes(routes: string[], timeoutMs = 30000) {
  if (!("serviceWorker" in navigator)) return true;
  // `.ready` only resolves once a registration exists for this scope and becomes active — it hangs
  // forever if register() was never called (e.g. dev, where offline-app-runtime.tsx intentionally
  // skips registration). Check for an existing registration first so this returns immediately when
  // there is nothing to wait for, instead of stalling the whole login flow.
  const existingRegistration = await navigator.serviceWorker.getRegistration("/");
  if (!existingRegistration) return true;
  const registration = await navigator.serviceWorker.ready;
  if (!registration.active) return false;
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean }>) => {
      window.clearTimeout(timer);
      resolve(event.data?.ok === true);
    };
    registration.active?.postMessage(
      { type: "WARM_OFFLINE_ROUTES", routes },
      [channel.port2],
    );
  });
}

export async function prepareOfflineSession(input: OfflineSessionInput) {
  if (typeof window === "undefined") return false;
  const configured = await configureLocalSync(input);
  if (!configured || !(await waitForLocalBootstrap())) return false;
  const response = await axios.post<LocalAgentResponse<unknown>>(
    `${AGENT_URL}/local/auth/cache`,
    {
      login_email: input.loginEmail,
      login_password: input.loginPassword,
      response: {
        status: "success",
        message: "Login success",
        token: input.token,
        login_uuid: input.actorLoginUuid,
        login_email: input.loginResponse.loginEmail,
        login_status: input.loginResponse.loginStatus,
        login_profile: input.loginResponse.loginProfile,
        branch_uuid: input.branchUuid,
        branch_name: input.loginResponse.branchName,
        branch_tel: input.loginResponse.branchTel,
        branch_address: input.loginResponse.branchAddress,
        store_uuid_fk: input.storeUuid,
        store_name: input.loginResponse.storeName,
        store_logo: input.loginResponse.storeLogo,
        store_table_status: input.loginResponse.storeTableStatus,
      },
    },
    { timeout: 5000 },
  );
  if (!response.data.ok) return false;
  try {
    await warmOfflineRoutes([
      "/", "/login", "/pos/tables", "/pos/order", "/order_manage",
      "/products", "/stock", "/sales/sales-list", "/report/daily-closing",
      "/report/daily-sales", "/report/best-selling-products",
      "/report/payment-methods", "/report/category-sales",
      "/settings/user", "/settings/branch",
    ]);
  } catch {
    // Local data/auth is already ready even when this browser cannot use a service worker.
  }
  try {
    // Persistent storage reduces IndexedDB eviction risk on dedicated POS devices.
    await navigator.storage?.persist?.();
  } catch {
    // Chrome may deny persistence; Agent SQLite still owns durable transactions.
  }
  return true;
}

export async function requestLocalFallback<T>(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  eventUuid: string | null,
  scope: BrowserOfflineIdentity = { storeUuid: "", branchUuid: "", actorLoginUuid: "" },
  browserStore?: BrowserOfflineStore,
): Promise<T> {
  const path = url.split("?")[0];
  const params = requestParams(url, options?.params);
  const data = options?.data ?? {};
  if (eventUuid) {
    try {
      await stageBrowserSyncRequest({
        ...scope,
        eventUuid,
        method,
        path,
        params,
        data,
      }, browserStore);
    } catch (error) {
      if (error instanceof Error && error.message === "BROWSER_SYNC_EVENT_PAYLOAD_MISMATCH") {
        throw error;
      }
      // IndexedDB is a resilience mirror. Agent SQLite remains authoritative
      // if Chrome denies storage or the local quota is temporarily unavailable.
    }
  }
  try {
    const response = await axios.post<LocalAgentResponse<T>>(
      `${AGENT_URL}/local/api`,
      {
        method: method.toUpperCase(),
        path,
        params,
        data,
        event_uuid: eventUuid,
      },
      { timeout: 10000 },
    );
    if (!response.data.ok || response.data.data === undefined) {
      throw new Error(response.data.error || "Local Agent request failed");
    }
    if (eventUuid) {
      await updateBrowserSyncEvent(eventUuid, {
        status: isLocalOnlyPrintRoute(method, url) ? "SYNCED" : "PENDING",
        lastError: null,
      }, browserStore).catch(() => undefined);
    } else if (isBrowserCacheableRead(method, url)) {
      await cacheBrowserApiResponse({
        ...scope,
        method,
        path,
        params,
        data,
        response: response.data.data,
        source: "AGENT",
      }, browserStore).catch(() => false);
    }
    return response.data.data;
  } catch (error) {
    if (eventUuid) {
      const rejectedByAgent = axios.isAxiosError(error) && Boolean(error.response);
      await updateBrowserSyncEvent(eventUuid, {
        status: rejectedByAgent ? "BLOCKED" : "STAGED",
        lastError: error instanceof Error ? error.message : "Local Agent request failed",
      }, browserStore).catch(() => undefined);
      throw error;
    }
    const cached = await readBrowserApiFallback<T>({
      ...scope,
      method,
      path,
      params,
      data,
    }, browserStore).catch(() => null);
    if (cached !== null) return cached;
    throw error;
  }
}

export function cacheOnlineResponse(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  response: unknown,
  branchUuid: string | undefined,
  storeUuid: string | undefined,
) {
  if (typeof window === "undefined") return;
  const scope = { storeUuid: storeUuid || "", branchUuid: branchUuid || "" };
  if (isBrowserCacheableRead(method, url)) {
    void cacheBrowserApiResponse({
      ...scope,
      method,
      path: url.split("?")[0],
      params: requestParams(url, options?.params),
      data: options?.data ?? {},
      response,
      source: "ONLINE",
    }).catch(() => false);
  } else if (OFFLINE_ROUTES.has(routeKey(method, url))) {
    void noteBrowserMutation(scope).catch(() => undefined);
  }
  if (method === "get" && OFFLINE_GET_ROUTES.has(url.split("?")[0])) {
    void axios.post(
      `${AGENT_URL}/local/cache/record`,
      {
        method: "GET",
        path: url.split("?")[0],
        params: requestParams(url, options?.params),
        response,
        branch_uuid: branchUuid || null,
      },
      { timeout: 3000 },
    ).catch(() => undefined);
    return;
  }
  if (!OFFLINE_ROUTES.has(routeKey(method, url))) return;
  void axios.post(
    `${AGENT_URL}/local/mirror`,
    {
      method: method.toUpperCase(),
      path: url.split("?")[0],
      params: requestParams(url, options?.params),
      data: options?.data ?? {},
      response,
    },
    { timeout: 3000 },
  ).catch(() => undefined);
}

export async function mirrorOnlineResponse(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  response: unknown,
  scope: BrowserOfflineScope = { storeUuid: "", branchUuid: "" },
) {
  await noteBrowserMutation(scope).catch(() => undefined);
  await axios.post(
    `${AGENT_URL}/local/mirror`,
    {
      method: method.toUpperCase(),
      path: url.split("?")[0],
      params: requestParams(url, options?.params),
      data: options?.data ?? {},
      response,
    },
    { timeout: 10000 },
  );
}

async function mirrorBrowserSyncStatus(status: LocalSyncStatus) {
  if (!status.store_uuid || !status.branch_uuid) return;
  await persistBrowserSyncStatus({
    storeUuid: status.store_uuid,
    branchUuid: status.branch_uuid,
    actorLoginUuid: status.actor_login_uuid ?? null,
    connectionState: status.connection_state ?? "DEGRADED",
    agentAvailable: true,
    pending: Number(status.pending?.pending || 0),
    processing: Number(status.pending?.processing || 0),
    failed: Number(status.pending?.failed || 0),
    blocked: Number(status.pending?.blocked || 0),
  });
}

export async function reconcileBrowserSyncQueue(
  scope: BrowserOfflineIdentity,
  browserStore?: BrowserOfflineStore,
) {
  const entries = (await listBrowserSyncQueue(scope, browserStore))
    .filter((entry) => !["SYNCED", "BLOCKED"].includes(entry.status))
    .slice(0, 50);

  for (const entry of entries) {
    if (entry.actorLoginUuid !== scope.actorLoginUuid) {
      await updateBrowserSyncEvent(entry.eventUuid, {
        status: "BLOCKED",
        lastError: "BROWSER_SYNC_ACTOR_MISMATCH",
      }, browserStore);
      continue;
    }
    try {
      const response = await axios.get<LocalAgentResponse<LocalSyncEvent>>(
        `${AGENT_URL}/local/sync/events/${encodeURIComponent(entry.eventUuid)}`,
        { timeout: 1500 },
      );
      const event = response.data.data;
      if (!response.data.ok || !event) break;
      await updateBrowserSyncEvent(entry.eventUuid, {
        status: localEventStatus(event.sync_status),
        dependencies: Array.isArray(event.dependencies) ? event.dependencies.map(String) : [],
        lastError: event.last_error ?? null,
      }, browserStore);
      continue;
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) break;
    }

    try {
      const response = await axios.post<LocalAgentResponse<unknown>>(
        `${AGENT_URL}/local/api`,
        {
          method: entry.method,
          path: entry.path,
          params: entry.params,
          data: entry.data,
          event_uuid: entry.eventUuid,
        },
        { timeout: 10000 },
      );
      if (!response.data.ok) throw new Error(response.data.error || "Local Agent request failed");
      await updateBrowserSyncEvent(entry.eventUuid, {
        status: isLocalOnlyPrintRoute(entry.method, entry.path) ? "SYNCED" : "PENDING",
        lastError: null,
      }, browserStore);
    } catch (error) {
      const rejectedByAgent = axios.isAxiosError(error) && Boolean(error.response);
      await updateBrowserSyncEvent(entry.eventUuid, {
        status: rejectedByAgent ? "BLOCKED" : "STAGED",
        lastError: error instanceof Error ? error.message : "Local Agent request failed",
      }, browserStore).catch(() => undefined);
      if (!rejectedByAgent) break;
    }
  }

  return getBrowserSyncQueueSummary(scope, browserStore);
}

export async function listBlockedBrowserSyncEvents(
  scope: BrowserOfflineScope,
  browserStore?: BrowserOfflineStore,
): Promise<BrowserSyncQueueEntry[]> {
  const entries = await listBrowserSyncQueue(scope, browserStore);
  return entries.filter((entry) => entry.status === "BLOCKED");
}

export async function retryBlockedBrowserSyncEvent(
  eventUuid: string,
  browserStore?: BrowserOfflineStore,
) {
  return updateBrowserSyncEvent(eventUuid, { status: "STAGED", lastError: null }, browserStore);
}

export async function discardBlockedBrowserSyncEvent(
  eventUuid: string,
  browserStore?: BrowserOfflineStore,
) {
  return discardBrowserSyncEvent(eventUuid, browserStore);
}

export function browserLocalSyncHasRetryableWork(summary: BrowserSyncQueueSummary) {
  return browserSyncQueueHasRetryableWork(summary);
}

export function getBrowserLocalSyncStatus(
  scope: BrowserOfflineIdentity,
  browserStore?: BrowserOfflineStore,
) {
  return getBrowserSyncQueueSummary(scope, browserStore);
}

export function persistBrowserAgentUnavailable(
  scope: BrowserOfflineScope,
  browserOffline: boolean,
  browserStore?: BrowserOfflineStore,
) {
  return persistBrowserSyncStatus({
    ...scope,
    connectionState: browserOffline ? "OFFLINE" : "DEGRADED",
    agentAvailable: false,
  }, browserStore);
}

export function resetLocalSyncConfiguration() {
  configureKey = "";
  configurePromise = null;
  localStatusCache = null;
  localStatusPromise = null;
}
