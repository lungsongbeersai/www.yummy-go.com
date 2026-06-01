import { apiRequest } from "@/lib/api";
import { toFormData } from "@/lib/form-data";
import { toApiLanguage } from "@/lib/language";
import { requiredText } from "@/services/shared/validators";
import type { ApiDataResponse, ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

interface CrudEndpoints {
  fetch?: string;
  fetchAll?: string;
  create?: string;
  delete?: string;
}

export function listParams(params: FetchParams = {}) {
  const query: Record<string, unknown> = {
    search: params.search ?? "",
    page: params.page ?? 1,
    orderBy: params.orderBy ?? "ASC",
    lang: toApiLanguage(params.lang)
  };

  if (params.limit === "All") {
    query.limit = "all";
  } else if (params.limit !== null) {
    query.limit = params.limit ?? 20;
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && !(key in query)) query[key] = value;
  });

  return query;
}

export async function fetchList<T extends ApiEntity>(
  endpoint: string,
  params: FetchParams = {},
  fallback = "Failed to fetch data"
) {
  return apiRequest<ApiListResponse<T>>(
    "get",
    endpoint,
    { params: listParams(params) },
    fallback
  );
}

export async function fetchAll<T extends ApiEntity>(
  endpoint: string,
  params: Record<string, unknown> = {},
  fallback = "Failed to fetch options"
) {
  const result = await apiRequest<ApiDataResponse<T[]>>(
    "get",
    endpoint,
    { params: { lang: toApiLanguage(String(params.lang ?? "la")), ...params } },
    fallback
  );
  return result.data ?? [];
}

export async function saveEntity<T extends ApiEntity>(
  endpoint: string,
  input: Record<string, unknown>,
  fallback = "Failed to save data",
  multipart = false
) {
  const data = multipart ? toFormData(input) : input;
  const result = await apiRequest<ApiDataResponse<T>>("post", endpoint, { data }, fallback);
  return result.data;
}

export async function deleteEntity(
  endpoint: string,
  key: string,
  value: string,
  fallback = "Failed to delete data"
) {
  await apiRequest("delete", endpoint, { data: { [key]: requiredText(value, key) } }, fallback);
}

export function createCrud<T extends ApiEntity>(
  endpoints: CrudEndpoints,
  idKey: string,
  multipart = false
) {
  return {
    list: (params?: FetchParams) => fetchList<T>(endpoints.fetch!, params),
    options: (params?: Record<string, unknown>) => fetchAll<T>(endpoints.fetchAll!, params),
    save: (input: Record<string, unknown>) => saveEntity<T>(endpoints.create!, input, undefined, multipart),
    delete: (id: string) => deleteEntity(endpoints.delete!, idKey, id)
  };
}
