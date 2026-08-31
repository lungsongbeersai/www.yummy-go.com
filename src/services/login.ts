import axios from "axios";
import { AGENT_URL } from "@/config/printer-agent";
import { publicApiClient, ServiceError } from "@/lib/api";
import type { AuthUser } from "@/stores/auth-store";

interface LoginApiResponse {
  status: string;
  message: string;
  token: string;
  login_uuid: string;
  login_email: string;
  login_status: number;
  login_profile?: string;
  branch_uuid?: string;
  branch_name?: string;
  branch_tel?: string;
  branch_address?: string;
  store_uuid_fk?: string;
  store_name?: string;
  store_logo?: string;
  store_table_status?: number;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
  source?: "online" | "offline";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapLoginResponse(data: LoginApiResponse & { offline?: boolean }): LoginResult {
  if (data.status !== "success" || !data.token) {
    throw new ServiceError(data.message || "Login failed", 401);
  }

  return {
    token: data.token,
    source: data.offline ? "offline" : "online",
    user: {
      uuid: data.login_uuid,
      email: data.login_email,
      status: data.login_status,
      profile: data.login_profile ?? "",
      branch_uuid: data.branch_uuid ?? "",
      branch_name: data.branch_name ?? "",
      branch_tel: data.branch_tel ?? "",
      branch_address: data.branch_address ?? "",
      store_uuid: data.store_uuid_fk ?? "",
      store_uuid_fk: data.store_uuid_fk ?? "",
      store_name: data.store_name ?? "",
      store_logo: data.store_logo ?? "",
      store_table_status: Number(data.store_table_status) === 2 ? 2 : 1
    }
  };
}

async function loginFromLocalAgent(login_email: string, login_password: string) {
  try {
    const response = await axios.post<{ ok: boolean; data?: LoginApiResponse & { offline?: boolean }; error?: string }>(
      `${AGENT_URL}/local/auth/login`,
      { login_email, login_password },
      { timeout: 5000 },
    );
    if (!response.data.ok || !response.data.data) throw new Error(response.data.error || "Local login failed");
    return mapLoginResponse(response.data.data);
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String((error.response?.data as { error?: string } | undefined)?.error || error.message)
      : error instanceof Error ? error.message : "Local login failed";
    throw new ServiceError(message, axios.isAxiosError(error) ? (error.response?.status || 503) : 503, error);
  }
}

function shouldFallbackToLocalLogin(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response || error.code === "ECONNABORTED") return true;
  const status = Number(error.response.status || 0);
  return status === 408 || status === 502 || status === 503 || status === 504 ||
    (status >= 521 && status <= 524) || status === 530;
}

export async function restoreOnlineLogin(localToken: string): Promise<LoginResult> {
  if (!localToken.startsWith("local.")) {
    throw new ServiceError("Local session token is required", 400);
  }

  try {
    const response = await axios.post<{
      ok: boolean;
      data?: LoginApiResponse;
      error?: string;
    }>(
      `${AGENT_URL}/local/auth/online`,
      { local_token: localToken },
      { timeout: 10000 },
    );
    if (!response.data.ok || !response.data.data) {
      throw new Error(response.data.error || "Online session restore failed");
    }
    return mapLoginResponse(response.data.data);
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String((error.response?.data as { error?: string } | undefined)?.error || error.message)
      : error instanceof Error ? error.message : "Online session restore failed";
    throw new ServiceError(message, axios.isAxiosError(error) ? (error.response?.status || 503) : 503, error);
  }
}

export async function checkLogin(login_email: string, login_password: string): Promise<LoginResult> {
  if (!login_email.trim()) throw new ServiceError("Email is required", 400);
  if (!login_password.trim()) throw new ServiceError("Password is required", 400);
  if (!EMAIL_RE.test(login_email)) throw new ServiceError("Invalid email", 400);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return loginFromLocalAgent(login_email, login_password);
  }

  try {
    const { data } = await publicApiClient.post<LoginApiResponse>(
      "/api/v1/login/check_login",
      { login_email, login_password },
      { timeout: 5000 },
    );
    return mapLoginResponse(data);
  } catch (error) {
    if (shouldFallbackToLocalLogin(error)) {
      return loginFromLocalAgent(login_email, login_password);
    }
    throw error;
  }
}
