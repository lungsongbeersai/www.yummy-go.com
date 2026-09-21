import { publicApiClient, ServiceError } from "@/lib/api";
import { classifyBackendError } from "@/lib/network-state";
import type { AuthUser } from "@/stores/auth-store";
import { backendNetworkManager } from "@/stores/network-store";

interface LoginApiResponse {
  status: string;
  message: string;
  token: string;
  login_uuid: string;
  login_email: string;
  login_status: number;
  login_profile?: string;
  zone_uuid_fk?: string | null;
  zone_name?: string;
  branch_uuid?: string;
  branch_name?: string;
  branch_tel?: string;
  branch_address?: string;
  store_uuid_fk?: string;
  store_name?: string;
  store_logo?: string;
  store_table_status?: number;
  deposit_expire_days?: number | null;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
  source?: "online";
}

export async function restoreOnlineLogin(_localToken: string): Promise<LoginResult> {
  void _localToken;
  throw new ServiceError("Offline login has been retired", 410);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapLoginResponse(data: LoginApiResponse): LoginResult {
  if (data.status !== "success" || !data.token) {
    throw new ServiceError(data.message || "Login failed", 401);
  }
  return {
    token: data.token,
    source: "online",
    user: {
      uuid: data.login_uuid,
      email: data.login_email,
      status: data.login_status,
      profile: data.login_profile ?? "",
      zone_uuid: data.zone_uuid_fk ?? "",
      zone_name: data.zone_name ?? "",
      branch_uuid: data.branch_uuid ?? "",
      branch_name: data.branch_name ?? "",
      branch_tel: data.branch_tel ?? "",
      branch_address: data.branch_address ?? "",
      store_uuid: data.store_uuid_fk ?? "",
      store_uuid_fk: data.store_uuid_fk ?? "",
      store_name: data.store_name ?? "",
      store_logo: data.store_logo ?? "",
      store_table_status: Number(data.store_table_status) === 2 ? 2 : 1,
      deposit_expire_days: data.deposit_expire_days ?? null,
    },
  };
}

export async function checkLogin(login_email: string, login_password: string): Promise<LoginResult> {
  if (!login_email.trim()) throw new ServiceError("Email is required", 400);
  if (!login_password.trim()) throw new ServiceError("Password is required", 400);
  if (!EMAIL_RE.test(login_email)) throw new ServiceError("Invalid email", 400);

  try {
    const response = await publicApiClient.post<LoginApiResponse>(
      "/api/v1/login/check_login",
      { login_email, login_password },
      { timeout: 8000 },
    );
    backendNetworkManager.reportReachable(response.status, "backend_login_response");
    return mapLoginResponse(response.data);
  } catch (error) {
    const classification = classifyBackendError(error);
    if (classification.classification === "HTTP_RESPONSE") {
      backendNetworkManager.reportReachable(classification.httpStatus, classification.reason);
    } else if (classification.classification === "NETWORK_TRANSPORT") {
      backendNetworkManager.reportTransportFailure(classification.reason);
    }
    throw error;
  }
}
