"use client";

import axios from "axios";
import {
  BACKEND_NETWORK_STATE,
  navigatorReportsOffline,
  type BackendNetworkState,
} from "@/lib/network-state";
import { AGENT_URL } from "@/config/printer-agent";
import { agentRejected, agentResponseError } from "@/services/agent-link";
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
import {
  findDetailByProdUuid,
  getOfflineSyncDeviceAuth,
  loadOfflineMasterIndex,
  loadOfflineOrderState,
  projectOfflineCart,
  projectOfflineProdItem,
  projectOfflineTables,
  resolveOrderUuid,
  synthesizeOfflineWrite,
} from "@/services/offline-order";

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

// Maps a route to the `operation` name Backend's /api/v1/sync/push expects
// (see SYNC_PUSH_ROUTES in back-end/api/v1/sync/registry.js) — exactly the
// routes `decodeOfflineOrderEvent` (offline-order/order-events.ts) knows how
// to replay locally on Android, so the two lists must stay in step.
const OFFLINE_ORDER_PUSH_OPERATIONS: Record<string, string> = {
  "POST /api/v1/posAll/create_order": "ORDER_CREATE",
  "PATCH /api/v1/posAll/order_item/update_qty": "ORDER_ITEM_QTY",
  "PATCH /api/v1/posAll/update_note": "ORDER_NOTE",
  "PATCH /api/v1/posAll/item_discount": "ORDER_ITEM_DISCOUNT",
  "PATCH /api/v1/posAll/bill_discount": "ORDER_DISCOUNT",
  "DELETE /api/v1/posAll/delete_order_item": "ORDER_ITEM_DELETE",
  "PATCH /api/v1/posAll/cancel_order_item": "ORDER_ITEM_CANCEL",
  "PATCH /api/v1/posAll/confirm_to_kitchen": "KITCHEN_CONFIRM",
  "PATCH /api/v1/posAll/confirm_order_item_served": "ORDER_ITEM_SERVED",
  "POST /api/v1/posAll/payment": "PAYMENT",
};

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
  // ป้ายชื่อ role และชื่อโซนของเพจ /printers — ไม่มี projection เฉพาะทางใน Agent แต่แคช GET
  // ทั่วไป (local_api_cache / Dexie) เก็บคำตอบตอนออนไลน์ไว้เล่นซ้ำได้ ถ้าไม่ใส่ไว้ เพจจะเปิดได้
  // แต่เด้ง toast "โหลดข้อมูลเครื่องพิมพ์ไม่สำเร็จ" ทุกครั้งเพราะ Promise.all มีตัวที่ reject
  "/api/v1/printer/roles",
  "/api/v1/zone/fetch_all",
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
    /** Kitchen confirmations held back by a ticket that failed to print. */
    waiting_on_print?: number;
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
  navigatorOffline: boolean = navigatorReportsOffline(),
) {
  return networkState !== BACKEND_NETWORK_STATE.OFFLINE &&
    !token?.startsWith("local.") &&
    !navigatorOffline;
}

export function shouldRouteToLocal(
  offlineSession: boolean,
  networkState: BackendNetworkState,
  method: HttpMethod,
  url: string,
  navigatorOffline: boolean = navigatorReportsOffline(),
) {
  return supportsOfflineRoute(method, url) &&
    (offlineSession ||
      navigatorOffline ||
      networkState === BACKEND_NETWORK_STATE.OFFLINE);
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
      "/products", "/stock", "/printers", "/sales/sales-list", "/report/daily-closing",
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
    // The Agent states why it refused in the body of its 4xx. Carry that
    // sentence out of here, or the till only ever sees axios's "Request failed
    // with status code 409" and the cashier cannot tell a closed bill from an
    // unconfigured device.
    const agentError = agentResponseError(error);
    if (eventUuid) {
      await updateBrowserSyncEvent(eventUuid, {
        status: agentRejected(agentError) ? "BLOCKED" : "STAGED",
        lastError: agentError.message,
      }, browserStore).catch(() => undefined);
      throw agentError;
    }
    const cached = await readBrowserApiFallback<T>({
      ...scope,
      method,
      path,
      params,
      data,
    }, browserStore).catch(() => null);
    if (cached !== null) return cached;
    throw agentError;
  }
}

export function cacheOnlineResponse(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  response: unknown,
  branchUuid: string | undefined,
  storeUuid: string | undefined,
  // Android has no Local Printer Agent. It still needs the Dexie mirror written,
  // because that mirror is the only offline source it has — but the two Agent
  // posts below would just be failed localhost requests on every response.
  agentAvailable: boolean = true,
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
  if (!agentAvailable) return;
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

const OVERLAY_PATHS = new Set([
  "/api/v1/posAll/fetch_cart",
  "/api/v1/posAll/fetch_table",
]);

const GET_PROD_ITEM_PATH = "/api/v1/posAll/get_prod_item";

/**
 * Folds every staged offline mutation on top of a cached fetch_cart/
 * fetch_table response, so a table opened or an item added while offline
 * shows up on the very next read of it — not just in the one synthesized
 * response `synthesizeOfflineWrite` returned at write time. `order_uuid`/
 * `table_uuid` come from the request that was actually made, not the cached
 * body — the real fetch_cart response nests those per-order, it never has
 * them at the top level.
 *
 * A table that has never been opened before has no cached fetch_cart at
 * all (there is nothing to have cached), which online is simply an empty
 * cart, not an error — so a cache miss on fetch_cart still projects an
 * answer from local state alone rather than surfacing as "nothing found"
 * and falling through to the original network error. fetch_table has no
 * such fallback: without at least one prior cached grid there is no
 * zone/table data to reconstruct from, so a miss there stays a miss.
 *
 * get_prod_item gets the same "miss is not a dead end" treatment, but from
 * a different source: `fetch_cate_products` (cached just by opening the
 * menu, for every product in it) already carries a default price/detail per
 * product, so a cache miss there is synthesized from that instead of from
 * staged order events. See `projectOfflineProdItem`.
 */
async function overlayOfflineOrderState(
  path: string,
  cached: unknown,
  requestParamsForPath: Record<string, unknown>,
  scope: BrowserOfflineScope,
  browserStore?: BrowserOfflineStore,
  requestData?: Record<string, unknown>,
): Promise<unknown> {
  if (path === GET_PROD_ITEM_PATH) {
    if (cached !== null) return cached;
    const prodUuid = typeof requestData?.prod_uuid === "string" ? requestData.prod_uuid : "";
    if (!prodUuid) return cached;
    try {
      const master = await loadOfflineMasterIndex(scope, browserStore);
      const detail = findDetailByProdUuid(master, prodUuid);
      return detail ? projectOfflineProdItem(detail) : cached;
    } catch (error) {
      console.error("[SYNC] offline product item synthesis failed", { path, error });
      return cached;
    }
  }
  if (!OVERLAY_PATHS.has(path)) return cached;
  if (cached === null && path !== "/api/v1/posAll/fetch_cart") return cached;
  try {
    const state = await loadOfflineOrderState(scope, browserStore);
    if (path === "/api/v1/posAll/fetch_table") return projectOfflineTables(cached, state);
    const master = await loadOfflineMasterIndex(scope, browserStore);
    return projectOfflineCart(
      state,
      {
        order_uuid: typeof requestParamsForPath.order_uuid === "string" ? requestParamsForPath.order_uuid : undefined,
        table_uuid: typeof requestParamsForPath.table_uuid === "string" ? requestParamsForPath.table_uuid : undefined,
      },
      master,
    );
  } catch (error) {
    // Overlay is a best-effort enhancement on top of an already-successful
    // cache read; a bug here must not turn a working cached response into no
    // response at all. Logged (not swallowed silently) because on the
    // fetch_cart cache-miss path above, this is the ONLY answer this request
    // can get — if this throws, the caller sees a raw network error instead
    // of the empty-cart fallback that path exists to provide.
    console.error("[SYNC] offline order state overlay failed", { path, error });
    return cached;
  }
}

/**
 * Reads a cacheable GET straight from the Dexie mirror, with no Local Agent in
 * the path. This is the offline read source for Android, which cannot reach an
 * Agent at all; every other platform keeps going through requestLocalFallback so
 * the Agent's SQLite stays authoritative. Returns null when nothing usable is
 * cached, so the caller can surface the original network error.
 */
export async function readBrowserOfflineCache<T>(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  scope: BrowserOfflineScope,
  browserStore?: BrowserOfflineStore,
): Promise<T | null> {
  if (typeof window === "undefined") return null;
  if (!isBrowserCacheableRead(method, url)) return null;
  const path = url.split("?")[0];
  const params = requestParams(url, options?.params);
  const data = record(options?.data);
  const cached = await readBrowserApiFallback<T>({
    ...scope,
    method,
    path,
    params,
    data,
  }, browserStore).catch(() => null);
  return overlayOfflineOrderState(path, cached, params, scope, browserStore, data) as Promise<T | null>;
}

/**
 * The Android equivalent of `requestLocalFallback`: no Agent process to hand
 * the write to, so the response is synthesized in-browser from the Dexie
 * outbox. Returns null for a route `offline-order` does not decode (table
 * move/join/split, printing) — those stay Agent-only and the caller falls
 * through to the original network error, same as before this existed.
 */
export async function requestBrowserWriteFallback<T>(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  eventUuid: string,
  scope: BrowserOfflineIdentity,
  browserStore?: BrowserOfflineStore,
): Promise<T | null> {
  if (typeof window === "undefined") return null;
  return synthesizeOfflineWrite(method, url, options, eventUuid, scope, browserStore) as Promise<T | null>;
}

export async function mirrorOnlineResponse(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  response: unknown,
  scope: BrowserOfflineScope = { storeUuid: "", branchUuid: "" },
) {
  await noteBrowserMutation(scope).catch(() => undefined);
  try {
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
  } catch (error) {
    throw agentResponseError(error, "Local Agent mirror failed");
  }
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

    // The Agent does not have this event. That reads two ways, and only one of
    // them is safe to recover from by re-sending.
    //
    // STAGED means the Agent never acknowledged it — the mutation was written to
    // this mirror and the Agent call failed without a reply — so the id has never
    // been used anywhere and re-sending is the recovery it was written for.
    //
    // Any other status means the Agent did accept it, which means it may already
    // sit on Backend under this id. Re-sending would not replay the original: the
    // Agent allocates a fresh invoice number, stock event and sequence, so the
    // payload hashes differently and Backend rejects it forever as
    // SYNC_EVENT_PAYLOAD_MISMATCH — taking every dependent event down with it.
    // That is exactly how a promotion-expired conflict turned into eight blocked
    // events and five items that never reached the server.
    //
    // Nothing is discarded and no new id is minted to slip past the conflict:
    // the event goes to the same review flow that already handles blocked work,
    // for a person to decide.
    if (entry.status !== "STAGED") {
      await updateBrowserSyncEvent(entry.eventUuid, {
        status: "BLOCKED",
        lastError: "BROWSER_SYNC_EVENT_MISSING_ON_AGENT",
      }, browserStore);
      continue;
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
      const agentError = agentResponseError(error);
      const rejectedByAgent = agentRejected(agentError);
      await updateBrowserSyncEvent(entry.eventUuid, {
        status: rejectedByAgent ? "BLOCKED" : "STAGED",
        lastError: agentError.message,
      }, browserStore).catch(() => undefined);
      if (!rejectedByAgent) break;
    }
  }

  return getBrowserSyncQueueSummary(scope, browserStore);
}

/**
 * Android's push loop: there is no Local Agent to reconcile against, so
 * staged mutations go straight to Backend's `/api/v1/sync/push` using this
 * device's own registered identity. Same recovery contract as
 * `reconcileBrowserSyncQueue` — SYNCED/BLOCKED are terminal, anything else is
 * left for the next reachable tick to retry, and a rejection is never worked
 * around by minting a new event id.
 */
// prepareOfflineRequest stamps every create_order call with a fresh random
// order_uuid purely so the local reducer has a stable id to key on — the
// real online flow (staff-order-payload.ts's buildStaffOrderInput) never
// sends order_uuid for a table order at all, since the Backend finds-or-
// creates the table's open order itself. order-state.ts's ORDER_CREATE
// handler already retargets a create onto a table's already-open order
// locally; pushing the event's *original* stamped order_uuid unchanged once
// that has happened tells the Backend's offline-sync path (api/v1/posAll/
// create.js) this create belongs to an order that does not match the
// table's real open one, and it rejects the whole event
// (SYNC_OPEN_ORDER_CONFLICT) rather than adding the items to it — the sync
// entry then dead-ends in BLOCKED, and the items are gone the moment the
// device reconnects and reads the real (unchanged) cart back. Resolving
// against the same fully-reduced local state the reducer itself produced,
// and rewriting the pushed order_uuid to match, is a no-op for a genuinely
// new order (nothing to retarget onto) and the fix for a retargeted one.
const CREATE_ORDER_ROUTE = "POST /api/v1/posAll/create_order";

export async function pushBrowserSyncQueue(
  scope: BrowserOfflineIdentity,
  browserStore?: BrowserOfflineStore,
): Promise<BrowserSyncQueueSummary | null> {
  const device = getOfflineSyncDeviceAuth();
  if (!device) return null;
  const entries = (await listBrowserSyncQueue(scope, browserStore))
    .filter((entry) => !["SYNCED", "BLOCKED"].includes(entry.status))
    .filter((entry) => `${entry.method} ${entry.path}` in OFFLINE_ORDER_PUSH_OPERATIONS)
    .slice(0, 50);
  if (!entries.length) return getBrowserSyncQueueSummary(scope, browserStore);

  const needsOrderUuidResolution = entries.some(
    (entry) => `${entry.method} ${entry.path}` === CREATE_ORDER_ROUTE,
  );
  const resolvedState = needsOrderUuidResolution
    ? await loadOfflineOrderState(scope, browserStore)
    : null;

  function pushDataFor(entry: BrowserSyncQueueEntry) {
    if (!resolvedState || `${entry.method} ${entry.path}` !== CREATE_ORDER_ROUTE) {
      return entry.data;
    }
    const data = record(entry.data);
    const resolved = resolveOrderUuid(resolvedState, data);
    return resolved && resolved !== data.order_uuid ? { ...data, order_uuid: resolved } : entry.data;
  }

  try {
    const response = await axios.post<{
      data?: { results?: Array<{ event_uuid: string; status: string; error?: string }> };
    }>(
      `${onlineApiBase()}/api/v1/sync/push`,
      {
        events: entries.map((entry) => ({
          event_uuid: entry.eventUuid,
          operation: OFFLINE_ORDER_PUSH_OPERATIONS[`${entry.method} ${entry.path}`],
          branch_uuid: entry.branchUuid,
          store_uuid: entry.storeUuid,
          device_code: device.deviceCode,
          actor_login_uuid: entry.actorLoginUuid,
          sequence: entry.createdAt,
          dependencies: entry.dependencies,
          payload: { request: { params: entry.params, data: pushDataFor(entry) } },
        })),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-sync-branch-uuid": scope.branchUuid,
          "x-sync-device-code": device.deviceCode,
          "x-sync-agent-secret": device.agentSecret,
        },
        timeout: 15000,
      },
    );
    const rows = response.data?.data?.results ?? [];
    const byUuid = new Map(rows.map((row) => [String(row.event_uuid), row]));
    for (const entry of entries) {
      const row = byUuid.get(entry.eventUuid);
      const status = row?.status === "SYNCED" || row?.status === "BLOCKED" ? row.status : "FAILED";
      await updateBrowserSyncEvent(entry.eventUuid, {
        status,
        lastError: status === "SYNCED" ? null : row?.error ?? "sync push result missing",
      }, browserStore).catch(() => undefined);
    }
  } catch {
    // Transport failure: every entry stays exactly as it was (STAGED/PENDING/
    // FAILED) for the next reachable tick to retry.
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

/** A bill as the till last recorded it, for a queue row that cannot clear itself. */
export interface StuckSyncOrder {
  order_uuid: string;
  order_invoice: string;
  table_uuid: string;
  table_name: string;
  order_status?: number;
  order_check_bill?: number;
  order_qty?: number;
  order_grand_total?: number;
  order_created_at?: number;
}

export interface StuckSyncEvent {
  event_uuid: string;
  operation: string;
  entity_type: string;
  entity_uuid: string | null;
  sync_status: "BLOCKED" | "FAILED" | "PENDING";
  retry_count: number;
  sequence_no: number;
  /** Event uuids this row waits for — the edges the cancel closure walks. */
  dependencies: string[];
  last_error: string | null;
  created_at: number;
  updated_at: number;
  next_attempt_at: number;
  stuck_for_ms: number;
  /** Held because its kitchen ticket is FAILED/UNCERTAIN — fixed at the printer. */
  waiting_on_print: boolean;
  /** Held because a parent event is itself stuck. */
  waiting_on_dependency: boolean;
  /** PAYMENT or BILL_SPLIT: needs an explicit opt-in before it can be discarded. */
  is_financial: boolean;
  order: StuckSyncOrder | null;
}

export interface StuckSyncDiscardResult {
  discarded: string[];
  cascaded: string[];
  skipped: { event_uuid: string; reason: string }[];
}

export interface StuckSyncDiscardOptions {
  includeFinancial?: boolean;
  reason?: string;
  actor?: string;
}

/**
 * Queue rows the Agent will never clear on its own.
 *
 * This is the Agent's own SQLite outbox, not the browser mirror the offline-sync
 * review page reads — the mirror can only forget its copy, while these are the
 * rows that actually hold a bill back from Backend.
 */
export async function listStuckLocalSyncEvents(): Promise<StuckSyncEvent[]> {
  if (typeof window === "undefined") return [];
  try {
    const response = await axios.get<LocalAgentResponse<{ events: StuckSyncEvent[] }>>(
      `${AGENT_URL}/local/sync/stuck`,
      { timeout: 5000 },
    );
    if (!response.data.ok) throw new Error(response.data.error || "stuck list failed");
    return response.data.data?.events ?? [];
  } catch (error) {
    throw agentResponseError(error);
  }
}

export async function discardStuckLocalSyncEvents(
  eventUuids: string[],
  options: StuckSyncDiscardOptions = {},
): Promise<StuckSyncDiscardResult> {
  return postDiscard("/local/sync/discard", { event_uuids: eventUuids }, options);
}

export async function discardAllStuckLocalSyncEvents(
  options: StuckSyncDiscardOptions = {},
): Promise<StuckSyncDiscardResult> {
  return postDiscard("/local/sync/discard-all", {}, options);
}

async function postDiscard(
  path: string,
  body: Record<string, unknown>,
  options: StuckSyncDiscardOptions,
): Promise<StuckSyncDiscardResult> {
  try {
    const response = await axios.post<LocalAgentResponse<StuckSyncDiscardResult>>(
      `${AGENT_URL}${path}`,
      {
        ...body,
        include_financial: options.includeFinancial === true,
        ...(options.reason ? { reason: options.reason } : {}),
        ...(options.actor ? { actor: options.actor } : {}),
      },
      { timeout: 15000 },
    );
    if (!response.data.ok) throw new Error(response.data.error || "discard failed");
    localStatusCache = null;
    return response.data.data ?? { discarded: [], cascaded: [], skipped: [] };
  } catch (error) {
    throw agentResponseError(error);
  }
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
