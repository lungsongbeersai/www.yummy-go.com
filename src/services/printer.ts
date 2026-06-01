import axios from "axios";
import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import {
  agentBase as printerAgentBase,
  assertAgentOk,
  failPayload,
  getPrinterErrorMessage,
  getRoleColor,
  mapPrinter,
  parseInterfaceValue
} from "@/services/printer/helpers";
import type { ApiDataResponse, ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";
import type { ConfirmToKitchenPendingQuery, ConfirmToKitchenPrintJob } from "@/services/pos";

export const AGENT_URL = process.env.NEXT_PUBLIC_PRINTER_AGENT_URL ?? "http://127.0.0.1:7777";
const AGENT_SECRET = process.env.NEXT_PUBLIC_PRINTER_AGENT_SECRET ?? "";
export { getPrinterErrorMessage, getRoleColor, parseInterfaceValue };

export interface SearchPrinterResult extends ApiEntity {
  name: string;
  interface_value: string;
  platform: string;
}
export interface AgentInfo extends ApiEntity {
  agent_id: string;
  agent_name: string;
  store_code?: string | null;
  branch_code?: string | null;
  device_code: string;
  hostname: string;
  platform: string;
  host: string;
  port: number;
}
export interface PrinterCategory extends ApiEntity {
  cate_uuid: string;
  cate_name?: string;
  cate_name_la?: string;
  cate_name_eng?: string;
}
export interface Printer extends ApiEntity {
  print_config_id?: string;
  print_config_uuid: string;
  branch_uuid_fk?: string;
  login_uuid_fk?: string;
  device_code?: string;
  printer_name: string;
  printer_type?: string;
  connect_type: string;
  interface_value: string;
  agent_url?: string;
  agent_id?: string;
  agent_name?: string;
  paper_width_mm: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  font_size?: number;
  role_codes: string[];
  categories?: PrinterCategory[];
  cate_uuid_fk: string[];
}
export interface PrinterRole extends ApiEntity { role_code: string; role_name: string }
interface SearchPrintersResponse extends ApiEntity {
  ok?: boolean;
  mode?: "usb" | "network";
  agent?: AgentInfo;
  data?: SearchPrinterResult[];
  error?: string;
  message?: string;
}
export type FetchPrinterResponse = ApiListResponse<Printer>;
export type PrinterRolesResponse = ApiDataResponse<PrinterRole[]>;
export interface SavePrinterInput extends ApiEntity {
  print_config_uuid?: string;
  login_uuid_fk: string;
  display_name: string;
  connect_type: "tcp" | "usb";
  ip?: string;
  port?: number;
  interface_value?: string;
  paper_width_mm: number;
  role_codes: string[];
  cate_uuid_fk?: string[];
  agent_url: string;
  agent_id: string;
  agent_name: string;
  device_code: string;
  font_size?: number;
}
export type SavePrinterResponse = ApiDataResponse<Printer>;
export interface BuildTestJobRequest extends ApiEntity {
  login_uuid_fk: string;
  print_config_uuid?: string;
  lang?: string;
  text?: string;
  display_name?: string;
  printer_name?: string;
  connect_type?: "tcp" | "usb";
  ip?: string;
  port?: number;
  interface_value?: string;
  paper_width_mm?: number;
  role_codes?: string[];
  agent_url?: string;
  agent_id?: string;
  agent_name?: string;
  device_code?: string;
  cate_uuid_fk?: string[];
}
export interface PrintJob extends ApiEntity {
  agent_url?: string;
  agent_id?: string;
  lang: string;
  paper_width_mm: number;
  interface_value: string;
  printer_type: string;
  ops: Record<string, unknown>[];
}
export interface PrintOpsAgentResponse extends ApiEntity { ok: boolean; error?: string; message?: string }
export interface BuildTestJobResponse extends ApiEntity { data: { printer: ApiEntity; job: PrintJob } }
export interface CategoryRole extends ApiEntity { cate_uuid: string; role_codes: string[] }
export interface SaveCategoryRoleInput extends ApiEntity { login_uuid_fk: string; cate_uuid_fk: string; role_codes: string[] }
export interface PrinterCategoryItem extends ApiEntity { cate_uuid: string }
export interface PrinterCategoryRole extends ApiEntity { print_config_uuid: string; categories: PrinterCategoryItem[] }
export interface ResolvedPrinter extends Printer {}
export interface SaveCategoryPrinterInput extends ApiEntity { login_uuid_fk: string; cate_uuid_fk: string[]; print_config_uuid_fk: string }
export interface FetchPrintersParams extends FetchParams { login_uuid_fk: string }
export interface AckResultItem { print_job_item_uuid: string; status: "success" | "failed"; reason?: string }
export interface AckPayload { print_job_uuid: string; results: AckResultItem[] }
export interface PendingPrintItem extends ApiEntity {
  print_job_item_uuid: string;
  can_print: boolean;
  error?: string | null;
  job: PrintJob;
  ack_success_payload: AckPayload;
  ack_failed_payload: AckPayload;
}
export interface PendingPrintJobData extends ApiEntity { print_job_uuid: string; print_items: PendingPrintItem[] }
export type PendingPrintJobsResponse = ApiDataResponse<PendingPrintJobData[]>;
export interface AckAppliedItem extends ApiEntity {}
export interface AckResponse extends ApiEntity {}
export interface KitchenPrintResult { successCount: number; failedCount: number; total: number }
export interface DefaultCategoryByRoleInput extends ApiEntity { login_uuid_fk: string; role_codes: string[]; lang?: string }
export interface DefaultCategoryGroupDetail extends ApiEntity {}
export interface DefaultCategoryGroup extends ApiEntity {}
export interface DefaultCategoryByRoleResponse extends ApiEntity {}
export interface TableQRPrintJob extends ApiEntity {
  agent_url?: string;
  document_type?: string;
  lang?: string;
  ops?: Record<string, unknown>[];
  qr_url?: string;
  table_name?: string;
}
export interface PrintProgress { total: number; completed: number; successCount: number; failedCount: number; phase: "fetching" | "printing" | "done" }
export interface ExecuteKitchenPrintInput {
  print_job?: ConfirmToKitchenPrintJob;
  pending_query?: ConfirmToKitchenPendingQuery;
  login_uuid_fk?: string;
  onProgress?: (progress: PrintProgress) => void;
}

export async function searchPrinters(mode: "usb" | "network" = "usb") {
  const { data } = await axios.get<SearchPrintersResponse>(
    `${printerAgentBase(AGENT_URL)}/printer/search-printer`,
    { params: { mode }, headers: { "x-agent-secret": AGENT_SECRET }, timeout: 5000 }
  );
  assertAgentOk(data, "Printer search failed");
  return { agent: data.agent ?? null, printers: data.data ?? [] };
}

export async function getPrinters(params: FetchPrintersParams) {
  const result = await apiRequest<FetchPrinterResponse>("get", "/api/v1/printer/fetch", {
    params: { login_uuid_fk: params.login_uuid_fk }
  });
  return (result.data ?? []).map((item) => mapPrinter(item));
}

export async function getPrinterOptions(login_uuid_fk: string, lang = "la") {
  const result = await apiRequest<ApiDataResponse<Printer[]>>("get", "/api/v1/printer/fetch_all", {
    params: { login_uuid_fk, lang: toApiLanguage(lang) }
  });
  return (result.data ?? []).map((item) => mapPrinter(item));
}

export async function getPrinterRoles(lang = "la") {
  const result = await apiRequest<PrinterRolesResponse>("get", "/api/v1/printer/roles", {
    params: { lang: toApiLanguage(lang) }
  });
  return result.data ?? [];
}

export async function savePrinter(input: SavePrinterInput) {
  const base = {
    print_config_uuid: input.print_config_uuid ?? "",
    login_uuid_fk: input.login_uuid_fk,
    display_name: input.display_name,
    connect_type: input.connect_type,
    paper_width_mm: input.paper_width_mm,
    role_codes: input.role_codes,
    agent_url: input.agent_url,
    agent_id: input.agent_id,
    agent_name: input.agent_name,
    device_code: input.device_code,
    cate_uuid_fk: input.cate_uuid_fk ?? []
  };
  const data =
    input.connect_type === "tcp"
      ? { ...base, ip: input.ip, port: input.port ?? 9100 }
      : { ...base, interface_value: input.interface_value ?? "" };
  const result = await apiRequest<SavePrinterResponse>("post", "/api/v1/printer/create", { data });
  return mapPrinter(result.data);
}

export const togglePrinterActive = (print_config_uuid: string) =>
  apiRequest("post", "/api/v1/printer/set-active", { data: { print_config_uuid } });
export const deletePrinter = (print_config_uuid: string) =>
  apiRequest("delete", "/api/v1/printer/delete", { data: { print_config_uuid } });
export const buildTestJob = (data: BuildTestJobRequest) =>
  apiRequest<BuildTestJobResponse>("post", "/api/v1/printer/build-test-job", { data });

export async function checkPrinterAgentConnection(agentUrl = AGENT_URL) {
  try {
    const { data } = await axios.get<AgentInfo>(`${printerAgentBase(AGENT_URL, agentUrl)}/agent/info`, {
      headers: { "x-agent-secret": AGENT_SECRET },
      timeout: 5000
    });
    return { ok: true, agent: data };
  } catch (error) {
    return { ok: false, error: getPrinterErrorMessage(error) };
  }
}

export async function printOps(job: PrintJob) {
  const { data } = await axios.post<PrintOpsAgentResponse>(`${printerAgentBase(AGENT_URL, job.agent_url)}/print-ops`, job, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: 10000
  });
  assertAgentOk(data, "Print failed");
}

export async function printTableQRJob(job: TableQRPrintJob, printEndpoint?: string) {
  if (Array.isArray(job.ops) && job.ops.length) {
    await printOps(job as PrintJob);
    return;
  }

  const { data } = await axios.post<PrintOpsAgentResponse>(printEndpoint ?? `${printerAgentBase(AGENT_URL, job.agent_url)}/print-ops`, job, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: 10000
  });
  assertAgentOk(data, "Print failed");
}

export async function getCategoryRoles(login_uuid_fk: string) {
  const result = await apiRequest<ApiDataResponse<CategoryRole[]>>("get", "/api/v1/printer/category-role/fetch", {
    params: { login_uuid_fk }
  });
  return result.data ?? [];
}

export const saveCategoryRole = (input: SaveCategoryRoleInput) =>
  apiRequest("post", "/api/v1/printer/category-role/save", { data: input }).then(() => undefined);
export async function fetchPrinterCategoryRole(login_uuid_fk: string, print_config_uuid_fk: string, lang = "la") {
  const result = await apiRequest<ApiDataResponse<PrinterCategoryRole | null>>(
    "get",
    "/api/v1/printer/category-printer/fetch_category_role",
    { params: { login_uuid_fk, print_config_uuid_fk, lang: toApiLanguage(lang) } }
  );
  return result.data ?? null;
}
export const saveCategoryPrinter = (input: SaveCategoryPrinterInput) =>
  apiRequest("post", "/api/v1/printer/category-printer/create", { data: input }).then(() => undefined);
export async function resolvePrintersByCategory(login_uuid_fk: string, cate_uuid_fk: string[]) {
  const result = await apiRequest<ApiDataResponse<ResolvedPrinter[]>>("post", "/api/v1/printer/resolve-by-category", {
    data: { login_uuid_fk, cate_uuid_fk }
  });
  return result.data ?? [];
}
export const getDefaultCategoryByRole = (input: DefaultCategoryByRoleInput) =>
  apiRequest<DefaultCategoryByRoleResponse>("post", "/api/v1/printer/category-printer/default-by-role", { data: input });
export async function getPendingPrintJobs(print_job_uuid: string, login_uuid_fk: string) {
  const result = await apiRequest<PendingPrintJobsResponse>("get", "/api/v1/printer/jobs/pending", {
    params: { print_job_uuid, login_uuid_fk }
  });
  return result.data ?? [];
}
export const ackPrintJob = (payload: AckPayload) =>
  apiRequest<AckResponse>("post", "/api/v1/printer/jobs/ack", { data: payload });

export async function executeKitchenPrintJobs(input: ExecuteKitchenPrintInput): Promise<KitchenPrintResult> {
  const jobUuid = input.pending_query?.print_job_uuid ?? input.print_job?.print_job_uuid;
  const loginUuid = input.pending_query?.login_uuid_fk ?? input.login_uuid_fk;
  if (!jobUuid || !loginUuid) return { successCount: 0, failedCount: 0, total: 0 };

  input.onProgress?.({ total: 0, completed: 0, successCount: 0, failedCount: 0, phase: "fetching" });
  const pending = await getPendingPrintJobs(jobUuid, loginUuid);
  const items = pending.flatMap((job) => job.print_items ?? []);
  let successCount = 0;
  let failedCount = 0;

  for (const item of items) {
    try {
      if (!item.can_print) throw new ServiceError(item.error || "Item cannot print", 400);
      await printOps(item.job);
      await ackPrintJob(item.ack_success_payload);
      successCount++;
    } catch (error) {
      await ackPrintJob(failPayload(item.ack_failed_payload, getPrinterErrorMessage(error)));
      failedCount++;
    }
    input.onProgress?.({
      total: items.length,
      completed: successCount + failedCount,
      successCount,
      failedCount,
      phase: "printing"
    });
  }

  input.onProgress?.({
    total: items.length,
    completed: items.length,
    successCount,
    failedCount,
    phase: "done"
  });
  return { successCount, failedCount, total: items.length };
}
