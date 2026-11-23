import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { fetchAll, listParams, saveEntity } from "@/services/shared/crud";
import { requiredText } from "@/services/shared/validators";
import type { ApiDataResponse, ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export type CashflowDirection = "income" | "expense";
export type CashflowCategoryDirection = CashflowDirection | "both";
export type CashflowCurrency = "LAK" | "THB" | "USD";
export type CashflowExpenseGroup = "shop" | "other";
export type CashflowPaymentMethod = "cash" | "transfer" | "other";

export interface CashflowBranchScope {
  branch_uuid?: string;
  branch_uuid_fk?: string;
}

export interface CashflowCategory extends ApiEntity {
  category_uuid: string;
  branch_uuid: string;
  name: string;
  direction: CashflowCategoryDirection;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveCashflowCategoryInput extends ApiEntity, CashflowBranchScope {
  category_uuid?: string;
  name: string;
  direction: CashflowCategoryDirection;
  is_active?: boolean;
}

export interface FetchCashflowCategoriesParams extends FetchParams, CashflowBranchScope {
  direction?: CashflowDirection | "all";
  include_inactive?: boolean;
}

export interface CashflowEntry extends ApiEntity {
  entry_uuid: string;
  branch_uuid: string;
  category_uuid_fk: string;
  category_name: string;
  entry_date: string;
  direction: CashflowDirection;
  expense_group: CashflowExpenseGroup | null;
  amount: number;
  currency: CashflowCurrency;
  exchange_rate: number;
  base_amount: number;
  description: string;
  reference: string;
  note: string;
  payment_method: CashflowPaymentMethod;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SaveCashflowEntryInput extends ApiEntity, CashflowBranchScope {
  entry_uuid: string;
  version?: number;
  category_uuid_fk: string;
  entry_date: string;
  direction: CashflowDirection;
  expense_group?: CashflowExpenseGroup | null;
  amount: number;
  currency: CashflowCurrency;
  description: string;
  reference?: string;
  note?: string;
  payment_method: CashflowPaymentMethod;
}

export interface FetchCashflowEntriesParams extends FetchParams, CashflowBranchScope {
  date_from?: string;
  date_to?: string;
  direction?: CashflowDirection | "all";
  expense_group?: CashflowExpenseGroup | "all";
  category_uuid_fk?: string;
  payment_method?: CashflowPaymentMethod | "all";
}

export interface CashflowPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CashflowEntriesResponse extends ApiListResponse<CashflowEntry> {
  pagination: CashflowPagination;
}

export interface CashflowReportSummary {
  sales_income: number;
  other_income: number;
  income_total: number;
  shop_expense: number;
  other_expense: number;
  expense_total: number;
  balance: number;
}

export interface CashflowReportDaily extends CashflowReportSummary {
  date: string;
}

export interface CashflowReportCategory {
  category_uuid: string;
  category_name: string;
  direction: CashflowCategoryDirection;
  income: number;
  expense: number;
  balance: number;
}

export interface CashflowReport {
  branch_uuid: string;
  date_from: string;
  date_to: string;
  summary: CashflowReportSummary;
  daily: CashflowReportDaily[];
  categories: CashflowReportCategory[];
}

export interface FetchCashflowReportParams extends CashflowBranchScope {
  date_from: string;
  date_to: string;
  lang?: string;
  direction?: CashflowDirection | "all";
  source?: "all" | "sales" | "manual";
  expense_group?: CashflowExpenseGroup | "all";
  category_uuid_fk?: string;
}

export function cashflowBranchUuid(scope: CashflowBranchScope) {
  return requiredText(scope.branch_uuid || scope.branch_uuid_fk, "branch_uuid");
}

function branchParams<T extends CashflowBranchScope>(params: T) {
  const query: Record<string, unknown> = { branch_uuid: cashflowBranchUuid(params) };
  for (const [key, value] of Object.entries(params)) {
    if (key !== "branch_uuid_fk" && key !== "branch_uuid") query[key] = value;
  }
  return query;
}

function money(value: unknown, field: string) {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") {
    throw new ServiceError(`Invalid cashflow ${field}`, 502);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new ServiceError(`Invalid cashflow ${field}`, 502);
  return number;
}

function normalizeEntry(entry: CashflowEntry): CashflowEntry {
  return { ...entry, amount: money(entry.amount, "amount"),
    exchange_rate: money(entry.exchange_rate, "exchange_rate"),
    base_amount: money(entry.base_amount, "base_amount"), version: money(entry.version, "version") };
}

function normalizeSummary<T extends CashflowReportSummary>(summary: T): T {
  if (!summary) throw new ServiceError("Invalid cashflow report summary", 502);
  return { ...summary, sales_income: money(summary.sales_income, "sales_income"),
    other_income: money(summary.other_income, "other_income"), income_total: money(summary.income_total, "income_total"),
    shop_expense: money(summary.shop_expense, "shop_expense"), other_expense: money(summary.other_expense, "other_expense"),
    expense_total: money(summary.expense_total, "expense_total"), balance: money(summary.balance, "balance") };
}

export function getCashflowCategories(params: FetchCashflowCategoriesParams) {
  return fetchAll<CashflowCategory>("/api/v1/cashflow/categories", { ...branchParams(params), lang: toApiLanguage(params.lang) });
}

export function saveCashflowCategory(input: SaveCashflowCategoryInput) {
  return saveEntity<CashflowCategory>("/api/v1/cashflow/categories/save", {
    branch_uuid: cashflowBranchUuid(input), ...(input.category_uuid ? { category_uuid: input.category_uuid } : {}),
    name: requiredText(input.name, "name"), direction: input.direction, is_active: input.is_active ?? true,
  });
}

export async function deleteCashflowCategory(categoryUuid: string, branchUuid: string) {
  await apiRequest("post", "/api/v1/cashflow/categories/delete", { data: {
    category_uuid: requiredText(categoryUuid, "category_uuid"), branch_uuid: requiredText(branchUuid, "branch_uuid"),
  } });
}

export async function getCashflowEntries(params: FetchCashflowEntriesParams): Promise<CashflowEntriesResponse> {
  const response = await apiRequest<CashflowEntriesResponse>("get", "/api/v1/cashflow/entries", {
    params: listParams(branchParams(params)),
  });
  if (!Array.isArray(response.data) || !response.pagination) throw new ServiceError("Invalid cashflow entries response", 502);
  const pagination = { page: Number(response.pagination.page), limit: Number(response.pagination.limit),
    total: Number(response.pagination.total), totalPages: Number(response.pagination.totalPages) };
  if (Object.values(pagination).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new ServiceError("Invalid cashflow pagination", 502);
  }
  return { ...response, data: response.data.map(normalizeEntry), pagination,
    total: pagination.total, totalPages: pagination.totalPages, page: pagination.page };
}

export async function saveCashflowEntry(input: SaveCashflowEntryInput) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new ServiceError("amount must be greater than zero", 400);
  const result = await saveEntity<CashflowEntry>("/api/v1/cashflow/entries/save", {
    branch_uuid: cashflowBranchUuid(input), entry_uuid: requiredText(input.entry_uuid, "entry_uuid"),
    ...(input.version !== undefined ? { version: input.version } : {}),
    category_uuid_fk: requiredText(input.category_uuid_fk, "category_uuid_fk"),
    entry_date: requiredText(input.entry_date, "entry_date"), direction: input.direction,
    expense_group: input.direction === "expense" ? input.expense_group : null,
    amount: input.amount, currency: input.currency, description: requiredText(input.description, "description"),
    reference: input.reference?.trim() ?? "", note: input.note?.trim() ?? "", payment_method: input.payment_method,
  });
  return normalizeEntry(result);
}

export async function deleteCashflowEntry(entryUuid: string, version: number, branchUuid: string) {
  await apiRequest("post", "/api/v1/cashflow/entries/delete", { data: {
    entry_uuid: requiredText(entryUuid, "entry_uuid"), version, branch_uuid: requiredText(branchUuid, "branch_uuid"),
  } });
}

export async function getCashflowReport(params: FetchCashflowReportParams): Promise<CashflowReport> {
  const branchUuid = cashflowBranchUuid(params);
  const dateFrom = requiredText(params.date_from, "date_from");
  const dateTo = requiredText(params.date_to, "date_to");
  const result = await apiRequest<ApiDataResponse<CashflowReport>>("get", "/api/v1/cashflow/report", {
    params: { ...branchParams(params), date_from: dateFrom, date_to: dateTo, lang: toApiLanguage(params.lang) },
  });
  if (!result.data || !Array.isArray(result.data.daily) || !Array.isArray(result.data.categories)) {
    throw new ServiceError("Invalid cashflow report response", 502);
  }
  if (typeof result.data.branch_uuid !== "string" ||
      result.data.branch_uuid.trim().toLowerCase() !== branchUuid.toLowerCase() ||
      result.data.date_from !== dateFrom || result.data.date_to !== dateTo) {
    throw new ServiceError("Cashflow report scope does not match the requested branch and dates", 502);
  }
  return { ...result.data, summary: normalizeSummary(result.data.summary), daily: result.data.daily.map(normalizeSummary),
    categories: result.data.categories.map((row) => ({ ...row, income: money(row.income, "category income"),
      expense: money(row.expense, "category expense"), balance: money(row.balance, "category balance") })) };
}
