"use client";

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { shouldLogoutForUnauthorized } from "@/lib/unauthorized-session";
import { contractExpiryFromPayload } from "@/lib/contract-expiry";
import { internalRoute } from "@/lib/routes";
import { useAuthStore } from "@/stores/auth-store";
import { createSessionGuard } from "@/stores/session-store-registry";

const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (typeof window !== "undefined" ? window.location.origin : undefined);

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public originalError?: unknown,
    public payload?: unknown,
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
  responseType?: "blob";
  timeout?: number;
  signal?: AbortSignal;
}

function createClient(authenticated: boolean): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (authenticated) {
    // A login can receive the same JWT string again. Rejections must also
    // belong to the same login generation before they can revoke credentials.
    const requestSessions = new WeakMap<InternalAxiosRequestConfig, () => boolean>();
    client.interceptors.request.use((config) => {
      requestSessions.set(config, createSessionGuard());
      const { token, isLoggedIn } = useAuthStore.getState();
      if (token && isLoggedIn) {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers["x-access-token"] = token;
      }
      if (config.data instanceof FormData) delete config.headers["Content-Type"];
      return config;
    });

    client.interceptors.response.use(
      (response) => {
        requestSessions.delete(response.config);
        return response;
      },
      (error: AxiosError) => {
        const belongsToCurrentSession = error.config ? requestSessions.get(error.config)?.() === true : false;
        if (error.config) requestSessions.delete(error.config);
        const status = error.response?.status;
        const requestToken = String(error.config?.headers.get("x-access-token") ?? "");
        const { isLoggedIn, logout, expireContract, token } = useAuthStore.getState();
        if (
          belongsToCurrentSession &&
          shouldLogoutForUnauthorized({
            currentToken: token,
            isLoggedIn,
            requestToken,
            status,
          })
        ) {
          const expiry = contractExpiryFromPayload(error.response?.data);
          if (expiry) expireContract(expiry); else logout();
          const destination = internalRoute(expiry ? "/subscription-expired" : "/login");
          if (typeof window !== "undefined") window.location.assign(destination);
        }
        return Promise.reject(error);
      },
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
  options?: RequestOptions,
) {
  const requestControls = {
    ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  };
  switch (method) {
    case "get":
      return client.get<T>(url, { params: options?.params, headers: options?.headers, responseType: options?.responseType, ...requestControls });
    case "post":
      return client.post<T>(url, options?.data, { headers: options?.headers, ...requestControls });
    case "put":
      return client.put<T>(url, options?.data, { headers: options?.headers, ...requestControls });
    case "patch":
      return client.patch<T>(url, options?.data, { headers: options?.headers, ...requestControls });
    case "delete":
      return client.delete<T>(url, {
        params: options?.params,
        data: options?.data,
        headers: options?.headers,
        ...requestControls,
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
      return new ServiceError(data?.message ?? fallback, error.response.status, error, error.response.data);
    }
    if (error.code === "ECONNABORTED") return new ServiceError("Connection timed out", 408, error);
    return new ServiceError(error.message || fallback, 0, error);
  }
  return new ServiceError(error instanceof Error ? error.message : fallback, 500, error);
}

async function requestOnline<T>(
  client: AxiosInstance,
  method: HttpMethod,
  url: string,
  options?: RequestOptions,
  fallback?: string,
) {
  try {
    const response = await send<T>(client, method, url, options);
    return assertApiSuccess(response.data);
  } catch (error) {
    throw normalizeError(error, fallback);
  }
}

export function apiRequest<T>(
  method: HttpMethod,
  url: string,
  options?: RequestOptions,
  fallback?: string,
) {
  return requestOnline<T>(apiClient, method, url, options, fallback);
}

export function publicApiRequest<T>(
  method: HttpMethod,
  url: string,
  options?: RequestOptions,
  fallback?: string,
) {
  return requestOnline<T>(publicApiClient, method, url, options, fallback);
}
