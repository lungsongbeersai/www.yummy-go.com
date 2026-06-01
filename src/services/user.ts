import { uploadedUrl } from "@/lib/image";
import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { createCrud } from "@/services/shared/crud";
import type { ApiDataResponse, ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface User extends ApiEntity {
  login_uuid: string;
  login_email?: string;
  login_status?: number;
  login_active?: number;
  login_profile?: string;
  roles_id_fk?: number;
  branch_uuid_fk?: string;
  branch_name?: string | null;
  roles_name?: string;
  roles_name_la?: string;
  roles_name_eng?: string;
  btn_disabled?: string;
  btn_disible?: string;
}
export type UserResponse = ApiListResponse<User>;
export interface Role extends ApiEntity {
  role_id?: number;
  role_name?: string;
  roles_id?: number;
  roles_name?: string;
  roles_name_la?: string;
  roles_name_eng?: string;
}
export type RolesResponse = ApiDataResponse<Role[]>;
export interface SaveUserInput extends ApiEntity {
  login_uuid?: string;
  login_email?: string;
  login_password?: string;
  login_active?: number;
  login_profile?: File | string;
  roles_id_fk?: number | string;
  branch_uuid_fk?: string;
}
export interface FetchUsersParams extends FetchParams {
  roles_id_fk?: number | string;
  branch_uuid_fk?: string;
}

const crud = createCrud<User>(
  {
    fetch: "/api/v1/register/fetch_limit",
    create: "/api/v1/register/create",
    delete: "/api/v1/register/delete"
  },
  "login_uuid",
  true
);

export const getUsers = (params: FetchUsersParams = {}) => crud.list(params);
export async function getUserById(login_uuid: string) {
  if (!login_uuid.trim()) throw new ServiceError("login_uuid is required", 400);
  const result = await apiRequest<ApiDataResponse<User>>("get", "/api/v1/register/get_id", {
    params: { login_uuid }
  });
  return result.data;
}
export async function getRoles(lang = "la", roles_id: number | string = "") {
  const roleId = Number(roles_id);
  if (!roleId) return [];
  const result = await apiRequest<RolesResponse>("post", `/api/v1/login/roles?lang=${toApiLanguage(lang)}`, {
    data: { roles_id: roleId }
  });
  return result.data ?? [];
}
export const saveUser = (input: SaveUserInput) => crud.save(input);
export const deleteUser = (login_uuid: string) => crud.delete(login_uuid);
export const getUserProfileUrl = (profilePath: string | null) =>
  uploadedUrl(profilePath, "uploaded/profile");
export const canCreateUser = (status?: number) => status === 1 || status === 2;
