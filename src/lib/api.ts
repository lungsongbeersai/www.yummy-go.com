"use client";

import axios, { AxiosError, type AxiosInstance } from "axios";
import { useAuthStore } from "@/stores/auth-store";

const baseURL = process.env.NEXT_PUBLIC_BASE_URL;

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
        const { isLoggedIn, logout } = useAuthStore.getState();
        if (status === 401 && isLoggedIn) {
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
  try {
    const response = await send<T>(apiClient, method, url, options);
    return assertApiSuccess(response.data);
  } catch (error) {
    throw normalizeError(error, fallback);
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
