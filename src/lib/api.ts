"use client";

import axios, { AxiosError, type AxiosInstance } from "axios";
import { shouldLogoutForUnauthorized } from "@/lib/unauthorized-session";
import {
  cacheOnlineResponse,
  configureLocalSync,
  mirrorOnlineResponse,
  needsLocalPrintOwnership,
  prepareOfflineRequest,
  requestLocalFallback,
  supportsOfflineRoute,
  withLocalPrintOwnership,
} from "@/services/offline-sync";
import { useAuthStore } from "@/stores/auth-store";

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (typeof window !== "undefined" ? window.location.origin : undefined);

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public originalError?: unknown
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
        const { isLoggedIn, logout, offlineSession, token } = useAuthStore.getState();
        if (
          !offlineSession &&
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
    throw new ServiceError(maybe.message ?? "Request failed", maybe.code ?? 400);
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

export async function apiRequest<T>(
  method: HttpMethod,
  url: string,
  options?: RequestOptions,
  fallback?: string
) {
  const prepared = prepareOfflineRequest(method, url, options);
  const auth = useAuthStore.getState();
  let localConfiguration: Promise<boolean> | null = null;
  if (auth.token && auth.user && supportsOfflineRoute(method, url)) {
    localConfiguration = auth.offlineSession
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
  if (localConfiguration && needsLocalPrintOwnership(method, url)) {
    localOwnsPrint = await localConfiguration;
    if (localOwnsPrint) requestOptions = withLocalPrintOwnership(requestOptions);
  }
  if (auth.offlineSession && supportsOfflineRoute(method, url) && typeof window !== "undefined") {
    const local = await requestLocalFallback<T>(method, url, requestOptions, prepared.eventUuid);
    return assertApiSuccess(local);
  }
  try {
    const response = await send<T>(apiClient, method, url, requestOptions);
    const data = assertApiSuccess(response.data);
    if (localOwnsPrint) {
      try {
        await mirrorOnlineResponse(method, url, requestOptions, data);
      } catch {
        try {
          await requestLocalFallback<T>(method, url, requestOptions, prepared.eventUuid);
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
        cacheOnlineResponse(method, url, requestOptions, data, auth.user?.branch_uuid);
      });
    } else {
      cacheOnlineResponse(method, url, requestOptions, data, auth.user?.branch_uuid);
    }
    return data;
  } catch (error) {
    const normalized = normalizeError(error, fallback);
    const isNetworkFailure = normalized.statusCode === 0 || normalized.statusCode === 408;
    const canContinueOffline = isNetworkFailure || (normalized.statusCode === 401 && auth.offlineSession);
    if (canContinueOffline && supportsOfflineRoute(method, url) && typeof window !== "undefined") {
      try {
        if (localConfiguration) await localConfiguration;
        const local = await requestLocalFallback<T>(method, url, requestOptions, prepared.eventUuid);
        return assertApiSuccess(local);
      } catch (localError) {
        throw new ServiceError(
          localError instanceof Error ? localError.message : "Local Agent request failed",
          503,
          { onlineError: normalized, localError },
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
    return assertApiSuccess(response.data);
  } catch (error) {
    throw normalizeError(error, fallback);
  }
}
