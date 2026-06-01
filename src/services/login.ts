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
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function checkLogin(login_email: string, login_password: string): Promise<LoginResult> {
  if (!login_email.trim()) throw new ServiceError("Email is required", 400);
  if (!login_password.trim()) throw new ServiceError("Password is required", 400);
  if (!EMAIL_RE.test(login_email)) throw new ServiceError("Invalid email", 400);

  const { data } = await publicApiClient.post<LoginApiResponse>("/api/v1/login/check_login", {
    login_email,
    login_password
  });

  if (data.status !== "success" || !data.token) {
    throw new ServiceError(data.message || "Login failed", 401);
  }

  return {
    token: data.token,
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
      store_logo: data.store_logo ?? ""
    }
  };
}
