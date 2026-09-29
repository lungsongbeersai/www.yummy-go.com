import { apiRequest } from "@/lib/api";
import { toFormData } from "@/lib/form-data";
import type {
  ApiDataResponse,
  ApiEntity,
  ApiListResponse,
} from "@/services/shared/types";

export interface Bank extends ApiEntity {
  bank_id?: number;
  bank_uuid: string;
  bank_name_la: string;
  bank_name_eng: string;
  bank_status: number;
}

export interface BranchAccount extends ApiEntity {
  account_id?: number;
  account_uuid: string;
  bank_uuid_fk: string;
  branch_uuid_fk: string;
  account_name: string;
  account_number: string;
  account_qr?: string;
  account_qr_raw?: string;
  account_status: number;
  bank_name_la: string;
  bank_name_eng: string;
  bank_status: number;
}

export interface SaveBankInput {
  bank_uuid?: string;
  bank_name_la: string;
  bank_name_eng?: string;
  bank_status: number;
}

export interface SaveBranchAccountInput {
  account_uuid?: string;
  bank_uuid_fk: string;
  branch_uuid_fk: string;
  account_name: string;
  account_number: string;
  account_qr?: File | string;
  account_status: number;
}

export async function fetchBanks() {
  const response = await apiRequest<ApiListResponse<Bank>>(
    "get",
    "/api/v1/bank/fetch_all",
  );
  return response.data ?? [];
}

export async function saveBank(input: SaveBankInput) {
  const response = await apiRequest<ApiDataResponse<Bank>>(
    "post",
    "/api/v1/bank/create",
    { data: input },
  );
  return response.data;
}

export async function fetchBranchAccounts(branchUuid: string) {
  if (!branchUuid) return [];
  const response = await apiRequest<ApiListResponse<BranchAccount>>(
    "get",
    "/api/v1/account/fetch_all",
    { params: { branch_uuid_fk: branchUuid } },
  );
  return response.data ?? [];
}

export async function saveBranchAccount(input: SaveBranchAccountInput) {
  const data =
    typeof File !== "undefined" && input.account_qr instanceof File
      ? toFormData({ ...input })
      : input;
  const response = await apiRequest<ApiDataResponse<BranchAccount>>(
    "post",
    "/api/v1/account/create",
    { data },
  );
  return response.data;
}

export async function fetchPosTransferAccounts() {
  const response = await apiRequest<ApiListResponse<BranchAccount>>(
    "get",
    "/api/v1/posAll/transfer_accounts",
  );
  return response.data ?? [];
}
