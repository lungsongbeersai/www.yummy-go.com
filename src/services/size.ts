import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Size extends ApiEntity {
  size_uuid: string;
  size_name?: string;
  size_name_la?: string;
  size_name_eng?: string;
}
export type SizeResponse = ApiListResponse<Size>;
export interface SaveSizeInput extends ApiEntity {
  size_uuid: string;
  size_name_la: string;
  size_name_eng: string;
  store_uuid_fk: string;
  status_sort_fk: number;
}
export type SaveSizeForStatusInput = SaveSizeInput;
export interface FetchSizesParams extends FetchParams {}

const crud = createCrud<Size>(
  {
    fetch: "/api/v1/sizes/fetch_limit",
    fetchAll: "/api/v1/sizes/fetch_all",
    create: "/api/v1/sizes/create",
    delete: "/api/v1/sizes/delete"
  },
  "size_uuid"
);

function sizeText(input: Record<string, unknown>, key: keyof SaveSizeInput) {
  const value = input[key];
  if (value === null || value === undefined) return "";
  return String(value);
}

export function sizePayloadForStatus(
  input: Record<string, unknown>,
  statusSortFk: number
): SaveSizeInput {
  return {
    ...input,
    size_uuid: sizeText(input, "size_uuid"),
    size_name_la: sizeText(input, "size_name_la"),
    size_name_eng: sizeText(input, "size_name_eng"),
    store_uuid_fk: sizeText(input, "store_uuid_fk"),
    status_sort_fk: statusSortFk
  } satisfies SaveSizeInput;
}

export const getSizes = (params: FetchSizesParams = {}) => crud.list(params);
export const getSizeOptions = (lang = "la", storeUuid?: string) =>
  crud.options({ lang, store_uuid_fk: storeUuid });
export const saveSize = (input: Record<string, unknown>) => crud.save(sizePayloadForStatus(input, 1));
export const saveSizeForStatus = (input: SaveSizeForStatusInput) =>
  crud.save(sizePayloadForStatus(input, Number(input.status_sort_fk || 1)));
export const deleteSize = (size_uuid: string) => crud.delete(size_uuid);
