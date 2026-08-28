"use client";

import axios from "axios";
import { AGENT_URL } from "@/config/printer-agent";
import type { HttpMethod, RequestOptions } from "@/lib/api";

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

interface LocalSyncStatus {
  bootstrap_complete: boolean;
  configured?: boolean;
  store_uuid?: string | null;
  branch_uuid?: string | null;
  actor_login_uuid?: string | null;
}

interface LocalAgentResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
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

export function supportsOfflineRoute(method: HttpMethod, url: string) {
  return (method === "get" && OFFLINE_GET_ROUTES.has(url.split("?")[0])) ||
    OFFLINE_ROUTES.has(routeKey(method, url)) ||
    LOCAL_READ_ROUTES.has(routeKey(method, url));
}

export function needsLocalPrintOwnership(method: HttpMethod, url: string) {
  return LOCAL_PRINT_OWNER_ROUTES.has(routeKey(method, url));
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
    data.new_order_invoice = String(
      data.new_order_invoice ||
      `OFF-SPLIT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${newOrderUuid.slice(0, 8).toUpperCase()}`,
    );
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
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
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
        ) return { data: { ok: true } };
      } catch {
        // Continue to configure below so the caller receives the existing failure behavior.
      }
    }
    return axios.post<LocalAgentResponse<unknown>>(
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
  })().then((response) => {
    const configured = response.data.ok === true;
    if (!configured) clearFailedConfiguration(nextKey);
    return configured;
  }).catch(() => {
    clearFailedConfiguration(nextKey);
    return false;
  });
  return configurePromise;
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
  return true;
}

export async function requestLocalFallback<T>(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  eventUuid: string | null,
): Promise<T> {
  const response = await axios.post<LocalAgentResponse<T>>(
    `${AGENT_URL}/local/api`,
    {
      method: method.toUpperCase(),
      path: url.split("?")[0],
      params: requestParams(url, options?.params),
      data: options?.data ?? {},
      event_uuid: eventUuid,
    },
    { timeout: 10000 },
  );
  if (!response.data.ok || response.data.data === undefined) {
    throw new Error(response.data.error || "Local Agent request failed");
  }
  return response.data.data;
}

export function cacheOnlineResponse(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  response: unknown,
  branchUuid: string | undefined,
) {
  if (typeof window === "undefined") return;
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
) {
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

export function resetLocalSyncConfiguration() {
  configureKey = "";
  configurePromise = null;
}
