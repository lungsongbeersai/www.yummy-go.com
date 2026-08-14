import { apiRequest, ServiceError } from "@/lib/api";
import { toFormData } from "@/lib/form-data";
import { toApiLanguage } from "@/lib/language";
import { createCrud } from "@/services/shared/crud";
import { requiredText } from "@/services/shared/validators";
import type { ApiDataResponse, ApiEntity, ApiListResponse, ApiMessageResponse, FetchParams } from "@/services/shared/types";
export { getUserProfileUrl } from "@/lib/image";

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
export interface ChangePasswordInput {
  login_uuid: string;
  old_password: string;
  new_password: string;
}
export interface UpdateProfileImageInput {
  login_uuid: string;
  profile: File;
}
// รูปแบบ response ของ endpoint นี้ไม่ใช่ envelope { data } ปกติ — คืนฟิลด์แบนตรงๆ ระดับบนสุด
export interface UpdateProfileImageResponse extends ApiMessageResponse {
  login_uuid: string;
  login_profile: string;
  login_profile_raw?: string;
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
export const canCreateUser = (status?: number) => status === 1 || status === 2;
// self-service เท่านั้น — backend ตรวจ old_password จึงเปลี่ยนได้แค่บัญชีที่ผู้เรียกรู้รหัสเดิม
// (คนละทางกับ saveUser ที่แอดมินตั้ง login_password ให้ลูกน้องได้ผ่าน register/create)
export async function changeUserPassword(input: ChangePasswordInput) {
  await apiRequest(
    "post",
    "/api/v1/register/change_password",
    {
      data: {
        login_uuid: requiredText(input.login_uuid, "login_uuid"),
        old_password: requiredText(input.old_password, "old_password"),
        new_password: requiredText(input.new_password, "new_password")
      }
    },
    "Failed to change password"
  );
}
// self-service เท่านั้น — อัปเดตแค่รูปโปรไฟล์ของบัญชีตัวเอง
export async function updateProfileImage(input: UpdateProfileImageInput) {
  return apiRequest<UpdateProfileImageResponse>(
    "post",
    "/api/v1/register/update_profile",
    {
      data: toFormData({
        login_uuid: requiredText(input.login_uuid, "login_uuid"),
        login_profile: input.profile
      })
    },
    "Failed to update profile image"
  );
}
