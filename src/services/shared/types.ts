export type SortOrder = "ASC" | "DESC" | "asc" | "desc" | "1" | "-1";
export type PageLimit = number | "All" | null;

export interface ApiEntity {
  [key: string]: unknown;
}

export interface FetchParams {
  search?: string;
  page?: number;
  limit?: PageLimit;
  orderBy?: SortOrder;
  lang?: string;
  [key: string]: unknown;
}

export interface ApiListResponse<T> {
  status: string;
  message: string;
  lang?: string;
  page?: number;
  limit?: PageLimit;
  total?: number;
  totalPages?: number;
  total_page?: number;
  data: T[];
  [key: string]: unknown;
}

export interface ApiDataResponse<T> {
  status: string;
  message: string;
  data: T;
  [key: string]: unknown;
}

export interface ApiMessageResponse {
  status: string;
  message: string;
  [key: string]: unknown;
}

export interface SelectRecord {
  label: string;
  value: string;
}
