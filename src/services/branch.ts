import { uploadedUrl } from "@/lib/image";
import { createCrud, listParams } from "@/services/shared/crud";
import { apiRequest, ServiceError } from "@/lib/api";
import type { ApiDataResponse, ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

let explicitStoreUuid = "";

export interface Branch extends ApiEntity {
  branch_uuid: string;
  branch_name?: string;
  branch_name_la?: string;
  branch_name_eng?: string;
  branch_tel?: string;
  branch_address?: string;
  branch_email?: string;
  branch_qr?: string;
  vat_status?: number;
  vat_name?: number;
  charge_status?: number;
  charge_name?: number;
  store_uuid_fk?: string;
}
export type BranchResponse = ApiListResponse<Branch>;
export interface SaveBranchInput extends ApiEntity {
  branch_uuid?: string;
  branch_name?: string | FormDataEntryValue;
  branch_tel?: string | FormDataEntryValue;
  branch_address?: string | FormDataEntryValue;
  branch_email?: string | FormDataEntryValue;
  branch_qr?: File | string;
  store_uuid_fk?: string;
  vat_status?: number | string;
  vat_name?: number | string;
  charge_status?: number | string;
  charge_name?: number | string;
}
export interface FetchBranchesParams extends FetchParams {}

const crud = createCrud<Branch>(
  {
    fetch: "/api/v1/branch/fetch_limit",
    fetchAll: "/api/v1/branch/fetch_all",
    create: "/api/v1/branch/create",
    delete: "/api/v1/branch/delete"
  },
  "branch_uuid",
  true
);

export const setStoreUuid = (uuid: string) => {
  explicitStoreUuid = uuid;
};

export const getStoreUuid = () => explicitStoreUuid;

export async function getBranches(params: FetchBranchesParams = {}) {
  const store_uuid_fk = String(params.store_uuid_fk ?? getStoreUuid());
  if (!store_uuid_fk) throw new ServiceError("store_uuid_fk is required", 400);
  return apiRequest<BranchResponse>("get", "/api/v1/branch/fetch_limit", {
    params: { ...listParams(params), store_uuid_fk }
  });
}

export async function getBranchOptions(store_uuid_fk = getStoreUuid()) {
  if (!store_uuid_fk) return [];
  const result = await apiRequest<ApiDataResponse<Branch[]>>("get", "/api/v1/branch/fetch_all", {
    params: { store_uuid_fk }
  });
  return result.data ?? [];
}

export const saveBranch = (input: SaveBranchInput) => {
  const payload: SaveBranchInput = {
    branch_uuid: input.branch_uuid ?? "",
    branch_name: input.branch_name,
    branch_tel: input.branch_tel,
    branch_address: input.branch_address,
    branch_email: input.branch_email,
    store_uuid_fk: input.store_uuid_fk,
    vat_status: Number(input.vat_status ?? 2),
    vat_name: Number(input.vat_name ?? 0),
    charge_status: Number(input.charge_status ?? 2),
    charge_name: Number(input.charge_name ?? 0)
  };

  if (input.branch_qr) payload.branch_qr = input.branch_qr;

  return crud.save(payload);
};
export const deleteBranch = (branch_uuid: string) => crud.delete(branch_uuid);
export const getBranchQrUrl = (filename: string) => uploadedUrl(filename, "uploaded/qrcode");
