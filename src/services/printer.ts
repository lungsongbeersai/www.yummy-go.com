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
  parseInterfaceValue,
  tcpInterfaceValue
} from "@/services/printer/helpers";
import {
  BROWSER_PRINTER_AGENT_ID,
  BROWSER_PRINTER_AGENT_URL,
  getBrowserPrinterIdentity,
  isBrowserPrinterAgentId
} from "@/services/printer/browser-device";
import type { ApiDataResponse, ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";
import type { ConfirmToKitchenPendingQuery, ConfirmToKitchenPrintJob } from "@/services/pos";

import { printMobileEscposOverTcp } from "@/services/printer/mobile-tcp";

export const AGENT_URL = process.env.NEXT_PUBLIC_PRINTER_AGENT_URL ?? "http://127.0.0.1:7777";
const AGENT_SECRET = process.env.NEXT_PUBLIC_PRINTER_AGENT_SECRET ?? "";
const PRINTER_IDENTITY_MISSING = "Printer device identity missing";
const LOCAL_AGENT_IDENTITY_KEY = "yummy_local_printer_agent_identity";
export {
  BROWSER_PRINTER_AGENT_ID,
  BROWSER_PRINTER_AGENT_URL,
  getPrinterErrorMessage,
  getRoleColor,
  isBrowserPrinterAgentId,
  parseInterfaceValue,
  tcpInterfaceValue
};

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
  device_code?: string | null;
  hostname?: string;
  platform?: string;
  host?: string;
  port?: number;
}
interface AgentInfoResponse extends ApiEntity {
  ok?: boolean;
  data?: AgentInfo;
  agent?: AgentInfo;
  error?: string;
  message?: string;
}

interface PendingPrintJobsFullResponse extends ApiEntity {
  data?: PendingPrintJobData[];
  print_batch_payloads?: PrintOpsBatchPayload[];
  ack_success_payload?: AckPayload;
  ack_failed_payload?: AckPayload;
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
  print_mode?: string;
  paper_width_mm: number;
  is_active: boolean;
  is_active_label?: string;
  created_at?: string;
  updated_at?: string;
  font_size?: number;
  role_codes: string[];
  categories?: PrinterCategory[];
  cate_uuid_fk: string[];
}
export interface PrinterRole extends ApiEntity { role_code: string; role_name: string }
export interface AgentFile extends ApiEntity {
  agent_file_uuid: string;
  file_name: string;
  file_platform: string;
  file_status: number;
  download_url: string;
}
interface SearchPrintersResponse extends ApiEntity {
  ok?: boolean;
  mode?: "usb" | "network";
  agent?: AgentInfo;
  data?: SearchPrinterResult[];
  error?: string;
  message?: string;
}
interface FetchPrinterPayload extends ApiEntity {
  login_uuid_fk?: string;
  branch_uuid_fk?: string;
  agent_id?: string;
  device_code?: string;
  print_mode?: string;
  total?: number;
  data?: Printer[];
}
export interface FetchPrinterResponse extends Omit<ApiListResponse<Printer>, "data"> {
  data: Printer[] | FetchPrinterPayload;
}
export type PrinterRolesResponse = ApiDataResponse<PrinterRole[]>;
export type AgentFilesResponse = ApiListResponse<AgentFile>;
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
  print_mode?: string;
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
  print_mode?: string;
  cate_uuid_fk?: string[];
}
export interface PrintJob extends ApiEntity {
  type?: string;
  agent_url?: string;
  agent_id?: string;
  agent_name?: string;
  device_code?: string | null;
  printer_name?: string | null;
  print_config_uuid?: string | null;
  job_id?: string;
  lang: string;
  paper_width_mm: number;
  print_client?: string;
  print_mode?: string;
  print_job_item_uuid?: string;
  requested_by?: string;
  interface_value: string;
  printer_type: string;
  ops: Record<string, unknown>[];
  meta?: ApiEntity | null;
}
export interface PrintOpsAgentResponse extends ApiEntity { ok: boolean; error?: string; message?: string }
export interface MobileEscposPayload extends ApiEntity {
  type?: string;
  render_mode?: string;
  printer_type?: string;
  paper_width_mm?: number;
  interface_value?: string;
  lang?: string;
  cut_mode?: string;
  jobs_total?: number;
  escpos_base64?: string | null;
  bytes?: number;
  meta?: ApiEntity | null;
}

export interface PrintOpsBatchPayload extends ApiEntity {
  type?: string;
  cut_mode: string;

  agent_id?: string | null;
  agent_name?: string | null;
  agent_url?: string | null;

  device_code?: string | null;
  print_mode?: string | null;
  print_client?: string | null;

  print_config_uuid?: string | null;
  printer_name?: string | null;
  interface_value?: string | null;
  printer_type?: string | null;
  paper_width_mm?: number | null;

  job_total?: number;
  jobs: PrintJob[];

  mobile_ready?: boolean;
  mobile_error?: string | null;
  mobile_escpos?: MobileEscposPayload | null;
}
export interface PrintOpsBatchAgentResponse extends ApiEntity {
  ok: boolean;
  request_id?: string;
  mode?: string;
  cut_mode?: string;
  jobs_total?: number;
  bytes?: number;
  printer?: ApiEntity;
  result?: ApiEntity;
  error?: string;
  message?: string;
}
export interface BuildTestJobResponse extends ApiEntity { data: { printer: ApiEntity; job: PrintJob } }
interface MobileEscposRenderResponse extends ApiEntity {
  data?: {
    escpos_base64?: string | null;
  } | null;
}
export interface CategoryRole extends ApiEntity { cate_uuid: string; role_codes: string[] }
export interface SaveCategoryRoleInput extends ApiEntity { login_uuid_fk: string; cate_uuid_fk: string; role_codes: string[] }
export interface PrinterCategoryItem extends ApiEntity { cate_uuid: string }
export interface PrinterCategoryRole extends ApiEntity { print_config_uuid: string; categories: PrinterCategoryItem[] }
export interface ResolvedPrinter extends Printer { }
export interface SaveCategoryPrinterInput extends ApiEntity { login_uuid_fk: string; cate_uuid_fk: string[]; print_config_uuid_fk: string }
export interface FetchPrintersParams extends FetchParams {
  login_uuid_fk: string;
  agent_id?: string;
  device_code?: string;
}
export interface FetchPrintersForLocalAgentParams extends FetchParams { login_uuid_fk: string }
export interface AckResultItem {
  print_job_item_uuid: string;
  status: "success" | "failed" | "skipped";
  reason?: string;
}
export interface AckPayload {
  login_uuid_fk?: string;
  print_job_uuid: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
  results: AckResultItem[];
}
export type PrintAckPayload = AckPayload & ApiEntity;
export interface PendingPrintItem extends ApiEntity {
  print_job_item_uuid: string;
  can_print: boolean;
  skip_without_print?: boolean;
  error?: string | null;
  job: PrintJob | null;
  ack_success_payload: AckPayload | null;
  ack_failed_payload: AckPayload | null;
  ack_skipped_payload?: AckPayload | null;
}
export interface PendingPrintJobData extends ApiEntity { print_job_uuid: string; print_items: PendingPrintItem[]; cut_mode?: string }
export type PendingPrintJobsResponse = ApiDataResponse<PendingPrintJobData[]>;
export interface PendingPrintJobsParams {
  print_job_uuid: string;
  login_uuid_fk: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}
export interface PrinterDeviceContextParams {
  login_uuid_fk: string;
  device_code?: string;
  agent_id?: string;
  agent_name?: string;
  print_mode?: string;
  print_config_uuid?: string;
  lang?: string;
}
export interface PrinterDeviceContext {
  device_code?: string;
  agent_id?: string;
  agent_name?: string;
  print_mode?: string;
}
export interface AckAppliedItem extends ApiEntity { }
export interface AckResponse extends ApiEntity { }
export interface KitchenPrintResult { successCount: number; failedCount: number; total: number }
export interface DefaultCategoryByRoleInput extends ApiEntity { login_uuid_fk: string; role_codes: string[]; lang?: string }
export interface DefaultCategoryGroupDetail extends ApiEntity { }
export interface DefaultCategoryGroup extends ApiEntity { }
export interface DefaultCategoryByRoleResponse extends ApiEntity { }
export interface PrintProgress { total: number; completed: number; successCount: number; failedCount: number; phase: "fetching" | "printing" | "done" }
export interface ExecuteKitchenPrintInput {
  print_job?: ConfirmToKitchenPrintJob;
  pending_query?: ConfirmToKitchenPendingQuery;
  login_uuid_fk?: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
  onProgress?: (progress: PrintProgress) => void;
}
export type ExecuteInvoicePrintInput = ExecuteKitchenPrintInput;

export async function searchPrinters(mode: "usb" | "network" = "usb") {
  const { data } = await axios.get<SearchPrintersResponse>(
    `${printerAgentBase(AGENT_URL)}/printer/search-printer`,
    { params: { mode }, headers: { "x-agent-secret": AGENT_SECRET }, timeout: 5000 }
  );
  assertAgentOk(data, "Printer search failed");
  return { agent: data.agent ?? null, printers: data.data ?? [] };
}

export async function getPrinters(params: FetchPrintersParams) {
  const deviceCode = textValue(params.device_code);
  const result = await apiRequest<FetchPrinterResponse>("get", "/api/v1/printer/fetch", {
    params: {
      login_uuid_fk: params.login_uuid_fk,
      ...(deviceCode ? { device_code: deviceCode } : {}),
      lang: toApiLanguage(params.lang)
    }
  });
  return printerRowsFromFetchResponse(result).map((item) => mapPrinter(item));
}

export async function resolvePrinterDeviceContext(params: PrinterDeviceContextParams): Promise<PrinterDeviceContext> {
  const inputDeviceCode = textValue(params.device_code);
  let agent: AgentInfo | null = null;
  if (!inputDeviceCode) {
    try {
      agent = await getLocalAgentInfo();
    } catch (error) {
      agent = readCachedLocalAgentInfo();
      if (!agent) throw error;
    }
  }
  const deviceCode = inputDeviceCode || textValue(agent?.device_code);
  if (!deviceCode) throw new ServiceError("device_code required", 400);

  const printers = await getPrinters({
    login_uuid_fk: params.login_uuid_fk,
    device_code: deviceCode,
    lang: params.lang
  });
  const printer =
    printers.find((item) => params.print_config_uuid && item.print_config_uuid === params.print_config_uuid) ??
    printers.find((item) => textValue(item.agent_id) === textValue(params.agent_id)) ??
    printers.find((item) => item.is_active) ??
    printers[0];
  const resolvedDeviceCode = textValue(printer?.device_code) || textValue(params.device_code) || deviceCode;
  if (!resolvedDeviceCode) throw new ServiceError("device_code required", 400);

  return {
    device_code: resolvedDeviceCode,
    agent_id: textValue(printer?.agent_id) || textValue(params.agent_id) || undefined,
    agent_name: textValue(printer?.agent_name) || textValue(params.agent_name) || undefined,
    print_mode: textValue(printer?.print_mode) || textValue(params.print_mode) || undefined
  };
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

export async function getAgentFiles() {
  const result = await apiRequest<AgentFilesResponse>("get", "/api/v1/agent/fetch");
  return result.data ?? [];
}

export async function savePrinter(input: SavePrinterInput) {
  const port = Number(input.port ?? 9100);
  const tcpPort = Number.isFinite(port) && port > 0 ? port : 9100;
  const interfaceValue =
    input.connect_type === "tcp"
      ? textValue(input.interface_value) || tcpInterfaceValue(input.ip, tcpPort)
      : textValue(input.interface_value);
  const isMobileWifi = textValue(input.print_mode) === "mobile_wifi";

  const base = {
    print_config_uuid: input.print_config_uuid ?? "",
    login_uuid_fk: input.login_uuid_fk,
    display_name: input.display_name,
    connect_type: input.connect_type,
    paper_width_mm: input.paper_width_mm,
    role_codes: input.role_codes,

    agent_url: isMobileWifi ? "" : input.agent_url || AGENT_URL,
    agent_id: input.agent_id,
    agent_name: input.agent_name,
    device_code: input.device_code || input.agent_id,
    print_mode: input.print_mode || undefined,

    cate_uuid_fk: input.cate_uuid_fk ?? []
  };
  const data =
    input.connect_type === "tcp"
      ? { ...base, ip: input.ip, port: tcpPort, interface_value: interfaceValue }
      : { ...base, interface_value: interfaceValue };
  const result = await apiRequest<SavePrinterResponse>("post", "/api/v1/printer/create", { data });
  return mapPrinter(result.data);
}

export const togglePrinterActive = (print_config_uuid: string) =>
  apiRequest("post", "/api/v1/printer/set-active", { data: { print_config_uuid } });
export const deletePrinter = (print_config_uuid: string) =>
  apiRequest("delete", "/api/v1/printer/delete", { data: { print_config_uuid } });
export const buildTestJob = (data: BuildTestJobRequest) =>
  apiRequest<BuildTestJobResponse>("post", "/api/v1/printer/build-test-job", { data });

export async function renderMobileEscpos(job: PrintJob) {
  const result = await apiRequest<MobileEscposRenderResponse>(
    "post",
    "/api/v1/printer/mobile/render-escpos",
    { data: job }
  );
  const escposBase64 = textValue(result.data?.escpos_base64);
  if (!escposBase64) throw new ServiceError("Mobile render response missing escpos_base64", 500);
  return escposBase64;
}

export async function sendMobileBackendPrintJob(job: PrintJob) {
  await apiRequest<MobileEscposRenderResponse>(
    "post",
    "/api/v1/printer/mobile/render-escpos",
    { data: job }
  );
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function localAgentStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readCachedLocalAgentInfo(): AgentInfo | null {
  const raw = textValue(localAgentStorage()?.getItem(LOCAL_AGENT_IDENTITY_KEY));
  if (!raw) return null;

  try {
    const record = JSON.parse(raw) as Partial<AgentInfo>;
    const agentId = textValue(record.agent_id);
    const deviceCode = textValue(record.device_code);
    if (!agentId || !deviceCode) return null;

    return {
      ...record,
      agent_id: agentId,
      agent_name: textValue(record.agent_name) || agentId,
      device_code: deviceCode,
      platform: textValue(record.platform)
    };
  } catch {
    return null;
  }
}

function saveCachedLocalAgentInfo(agent: AgentInfo) {
  const agentId = textValue(agent.agent_id);
  const deviceCode = textValue(agent.device_code);
  if (!agentId || !deviceCode) return;

  localAgentStorage()?.setItem(
    LOCAL_AGENT_IDENTITY_KEY,
    JSON.stringify({
      agent_id: agentId,
      agent_name: textValue(agent.agent_name) || agentId,
      device_code: deviceCode,
      platform: textValue(agent.platform) || undefined
    })
  );
}

function printerRowsFromFetchResponse(result: FetchPrinterResponse) {
  if (Array.isArray(result.data)) return result.data;
  const payload = result.data;
  if (!Array.isArray(payload?.data)) return [];
  const wrapperDeviceCode = textValue(payload.device_code) || undefined;
  const wrapperAgentId = textValue(payload.agent_id) || undefined;
  const wrapperPrintMode = textValue(payload.print_mode) || undefined;

  return payload.data.map((item) => ({
    ...item,
    device_code: item.device_code ?? wrapperDeviceCode,
    agent_id: item.agent_id ?? wrapperAgentId,
    print_mode: item.print_mode ?? wrapperPrintMode
  }));
}

function getAgentFromPayload(payload: AgentInfoResponse | AgentInfo | null | undefined): AgentInfo | null {
  const maybe = payload as AgentInfoResponse | null | undefined;
  const agent = maybe?.data ?? maybe?.agent ?? payload;
  if (!agent || typeof agent !== "object") return null;
  const record = agent as AgentInfo;
  const agentId = textValue(record.agent_id);
  if (!agentId) return null;
  return {
    ...record,
    agent_id: agentId,
    agent_name: textValue(record.agent_name) || agentId,
    device_code: textValue(record.device_code) || undefined,
    platform: textValue(record.platform)
  };
}

async function getLocalAgentInfo(agentUrl = AGENT_URL) {
  const { data } = await axios.get<AgentInfoResponse | AgentInfo>(`${printerAgentBase(AGENT_URL, agentUrl)}/agent/info`, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: 5000
  });
  assertAgentOk(data as AgentInfoResponse, "Printer agent not ready");

  const agent = getAgentFromPayload(data);
  if (!agent) throw new ServiceError("Local printer agent identity missing", 500);
  const cached = readCachedLocalAgentInfo();
  const merged = {
    ...agent,
    device_code: textValue(agent.device_code) || textValue(cached?.device_code) || undefined
  };
  saveCachedLocalAgentInfo(merged);
  return merged;
}

export async function getLocalPrinterAgentInfo(agentUrl = AGENT_URL) {
  try {
    return await getLocalAgentInfo(agentUrl);
  } catch (error) {
    const cached = readCachedLocalAgentInfo();
    if (cached) return cached;
    throw error;
  }
}

function printJobAgentBase(job: PrintJob | null | undefined) {
  return printerAgentBase(AGENT_URL, textValue(job?.agent_url) || undefined);
}

function isPrintJobForAgent(job: PrintJob | null | undefined, agent: AgentInfo) {
  const jobAgentId = textValue(job?.agent_id);
  const localAgentId = textValue(agent.agent_id);
  if (!jobAgentId || !localAgentId || jobAgentId !== localAgentId) return false;

  const jobDeviceCode = textValue(job?.device_code);
  const localDeviceCode = textValue(agent.device_code);
  if (localDeviceCode && (!jobDeviceCode || jobDeviceCode !== localDeviceCode)) return false;

  return true;
}

function assertPrintJobForAgent(job: PrintJob, agent: AgentInfo) {
  if (!textValue(job.agent_id)) {
    throw new ServiceError("Print job missing agent_id", 409);
  }
  if (!isPrintJobForAgent(job, agent)) {
    throw new ServiceError("Print job belongs to another agent", 409);
  }
}

function isBrowserDevicePrintJob(job: PrintJob | null | undefined) {
  return isBrowserPrinterAgentId(job?.agent_id) && textValue(job?.device_code).includes("-web-");
}

export type CheckPrinterAgentConnectionResult =
  | { ok: true; agent: AgentInfo }
  | { ok: false; error: string };

export async function checkPrinterAgentConnection(agentUrl = AGENT_URL): Promise<CheckPrinterAgentConnectionResult> {
  try {
    const { data } = await axios.get<AgentInfoResponse | AgentInfo>(`${printerAgentBase(AGENT_URL, agentUrl)}/agent/info`, {
      headers: { "x-agent-secret": AGENT_SECRET },
      timeout: 5000
    });
    assertAgentOk(data as AgentInfoResponse, "Printer agent not ready");

    const agent = getAgentFromPayload(data);
    if (!agent) throw new ServiceError("Local printer agent identity missing", 500);
    return { ok: true, agent };
  } catch (error) {
    return { ok: false, error: getPrinterErrorMessage(error) };
  }
}

function hasPrinterDeviceIdentity(agent: AgentInfo | null | undefined) {
  return Boolean(textValue(agent?.agent_id) && textValue(agent?.device_code));
}

export async function resolvePrinterDeviceIdentity(agentUrl = AGENT_URL): Promise<CheckPrinterAgentConnectionResult> {
  try {
    const result = await checkPrinterAgentConnection(agentUrl);
    if (!result.ok) {
      return { ok: true, agent: await getBrowserPrinterIdentity() };
    }
    if (!hasPrinterDeviceIdentity(result.agent)) {
      return { ok: false, error: PRINTER_IDENTITY_MISSING };
    }

    return result;
  } catch (error) {
    return { ok: false, error: getPrinterErrorMessage(error) };
  }
}

export async function printWithLocalAgent(job: PrintJob, localAgent?: AgentInfo) {
  const agent = localAgent ?? await getLocalAgentInfo();
  assertPrintJobForAgent(job, agent);

  const { data } = await axios.post<PrintOpsAgentResponse>(`${printerAgentBase(AGENT_URL)}/print-ops`, job, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: 10000
  });
  assertAgentOk(data, "Print failed");
}

export async function printBatchWithLocalAgent(
  jobs: PrintJob[],
  localAgent?: AgentInfo,
  cutMode: string = "per_ticket"
) {
  if (!jobs.length) return;

  const agentBase = printJobAgentBase(jobs[0]);
  if (jobs.some((job) => printJobAgentBase(job) !== agentBase)) {
    throw new ServiceError("Print batch contains multiple agent URLs", 400);
  }

  const agent = localAgent ?? await getLocalAgentInfo(agentBase);
  for (const job of jobs) {
    assertPrintJobForAgent(job, agent);
  }

  const payload: PrintOpsBatchPayload = { cut_mode: cutMode, jobs };
  const { data } = await axios.post<PrintOpsBatchAgentResponse>(`${agentBase}/print-ops-batch`, payload, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: 20000
  });
  assertAgentOk(data, "Print failed");
}

async function printKitchenBatchJob(batch: PrintOpsBatchPayload) {
  if (!batch.jobs.length) return;

  const agentBase = printerAgentBase(
    AGENT_URL,
    textValue(batch.agent_url) || textValue(batch.jobs[0]?.agent_url) || undefined
  );
  const agent = await getLocalAgentInfo(agentBase);
  for (const job of batch.jobs) {
    assertPrintJobForAgent(job, agent);
  }

  const { data } = await axios.post<PrintOpsBatchAgentResponse>(`${agentBase}/print-ops-batch`, batch, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: 20000
  });
  assertAgentOk(data, "Print failed");
}

export async function dispatchPrintJob(
  job: PrintJob,
  localAgent?: AgentInfo,
) {
  if (isBrowserDevicePrintJob(job)) {
    await sendMobileBackendPrintJob(job);
    return;
  }

  await printWithLocalAgent(job, localAgent);
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
export async function getPendingPrintJobs(params: PendingPrintJobsParams) {
  const result = await apiRequest<PendingPrintJobsFullResponse>("get", "/api/v1/printer/jobs/pending", {
    params: {
      print_job_uuid: params.print_job_uuid,
      login_uuid_fk: params.login_uuid_fk,
      device_code: params.device_code,
      agent_id: params.agent_id,
      print_mode: params.print_mode
    }
  });
  return {
    jobs: result.data ?? [],
    batchPayloads: result.print_batch_payloads ?? [],
    ackSuccess: result.ack_success_payload ?? null,
    ackFailed: result.ack_failed_payload ?? null,
  };
}
export const ackPrintJob = (payload: AckPayload) =>
  apiRequest<AckResponse>("post", "/api/v1/printer/jobs/ack", {
    data: payload
  });

function ackPayloadWithLogin(payload: AckPayload, loginUuid: string): AckPayload {
  return { ...payload, login_uuid_fk: payload.login_uuid_fk ?? loginUuid };
}

function reportKitchenProgress(
  input: ExecuteKitchenPrintInput,
  total: number,
  successCount: number,
  failedCount: number,
  skippedCount: number
) {
  input.onProgress?.({
    total,
    completed: successCount + failedCount + skippedCount,
    successCount,
    failedCount,
    phase: "printing"
  });
}

function kitchenCutMode(input: ExecuteKitchenPrintInput, pending: PendingPrintJobData[]) {
  return textValue(input.print_job?.cut_mode) || textValue(pending.find((job) => textValue(job.cut_mode))?.cut_mode) || "per_ticket";
}

function groupKitchenBatchItems(items: PendingPrintItem[]) {
  const groups = new Map<string, PendingPrintItem[]>();

  for (const item of items) {
    if (!item.job) continue;
    const key = printJobAgentBase(item.job);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return Array.from(groups.values());
}

async function printKitchenMobileBatch(batch: PrintOpsBatchPayload) {
  const mobileEscpos = batch.mobile_escpos ?? null;

  const escposBase64 = textValue(mobileEscpos?.escpos_base64);

  const interfaceValue =
    textValue(mobileEscpos?.interface_value) ||
    textValue(batch.interface_value) ||
    textValue(batch.jobs?.[0]?.interface_value);

  if (!escposBase64) {
    throw new ServiceError(
      batch.mobile_error || "Mobile ESC/POS payload missing",
      500
    );
  }

  if (!interfaceValue) {
    throw new ServiceError("Mobile printer interface_value missing", 400);
  }

  await printMobileEscposOverTcp({
    interface_value: interfaceValue,
    escpos_base64: escposBase64,
  });
}

function isMobilePrintBatch(batch: PrintOpsBatchPayload) {
  const printClient = textValue(batch.print_client).toLowerCase();
  const printMode = textValue(batch.print_mode).toLowerCase();

  return (
    printClient === "mobile_wifi" ||
    printMode === "mobile_wifi" ||
    Boolean(textValue(batch.mobile_escpos?.escpos_base64))
  );
}

function printBatchJobTotal(batch: PrintOpsBatchPayload) {
  const jobsTotal = Array.isArray(batch.jobs) ? batch.jobs.length : 0;
  const declaredTotal = Number(batch.job_total || 0);

  return jobsTotal || declaredTotal || 0;
}

async function executePrintJobs(input: ExecuteKitchenPrintInput, options: { ack: boolean }): Promise<KitchenPrintResult> {
  const jobUuid = input.pending_query?.print_job_uuid ?? input.print_job?.print_job_uuid;
  const loginUuid = input.pending_query?.login_uuid_fk ?? input.login_uuid_fk;

  if (!jobUuid || !loginUuid) {
    return {
      successCount: 0,
      failedCount: 0,
      total: 0,
    };
  }

  input.onProgress?.({
    total: 0,
    completed: 0,
    successCount: 0,
    failedCount: 0,
    phase: "fetching",
  });

  const pendingParams =
    input.pending_query?.device_code &&
      input.pending_query.print_job_uuid &&
      input.pending_query.login_uuid_fk
      ? input.pending_query
      : {
        print_job_uuid: jobUuid,
        login_uuid_fk: loginUuid,
        ...(await resolvePrinterDeviceContext({
          login_uuid_fk: loginUuid,
          device_code: input.pending_query?.device_code ?? input.device_code,
          agent_id: input.pending_query?.agent_id ?? input.agent_id,
          print_mode: input.pending_query?.print_mode ?? input.print_mode,
        })),
      };

  const pendingResult = await getPendingPrintJobs(pendingParams);

  const pending = pendingResult.jobs;
  const batchPayloads = pendingResult.batchPayloads;
  const globalAckSuccess = pendingResult.ackSuccess;
  const globalAckFailed = pendingResult.ackFailed;

  if (batchPayloads.length > 0) {
    const total = batchPayloads.reduce(
      (sum, batch) => sum + printBatchJobTotal(batch),
      0
    );

    input.onProgress?.({
      total,
      completed: 0,
      successCount: 0,
      failedCount: 0,
      phase: "printing",
    });

    try {
      for (const batch of batchPayloads) {
        if (isMobilePrintBatch(batch)) {
          await printKitchenMobileBatch(batch);
        } else {
          await printKitchenBatchJob(batch);
        }
      }

      if (options.ack && globalAckSuccess) {
        await ackPrintJob(
          ackPayloadWithLogin(globalAckSuccess, loginUuid)
        );
      }

      input.onProgress?.({
        total,
        completed: total,
        successCount: total,
        failedCount: 0,
        phase: "done",
      });

      return {
        successCount: total,
        failedCount: 0,
        total,
      };
    } catch (error) {
      if (options.ack && globalAckFailed) {
        await ackPrintJob(
          ackPayloadWithLogin(
            failPayload(globalAckFailed, getPrinterErrorMessage(error)),
            loginUuid
          )
        );
      }

      input.onProgress?.({
        total,
        completed: total,
        successCount: 0,
        failedCount: total,
        phase: "done",
      });

      return {
        successCount: 0,
        failedCount: total,
        total,
      };
    }

  }

  const printItems = pending.flatMap((job) => job.print_items ?? []);
  const cutMode = kitchenCutMode(input, pending);

  const items = printItems.filter((item) => {
    if (!item.can_print) return true;
    return Boolean(item.job);
  });

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const batchItems: PendingPrintItem[] = [];

  for (const item of items) {
    try {
      if (item.skip_without_print && item.ack_skipped_payload) {
        if (options.ack) {
          await ackPrintJob(
            ackPayloadWithLogin(item.ack_skipped_payload, loginUuid)
          );
        }

        skippedCount++;

        reportKitchenProgress(
          input,
          items.length,
          successCount,
          failedCount,
          skippedCount
        );

        continue;
      }

      if (!item.can_print) {
        throw new ServiceError(item.error || "Item cannot print", 400);
      }

      if (!item.job || (options.ack && !item.ack_success_payload)) {
        throw new ServiceError("Print job payload missing", 400);
      }

      if (!isBrowserDevicePrintJob(item.job)) {
        batchItems.push(item);
        continue;
      }

      await dispatchPrintJob(item.job);

      if (options.ack && item.ack_success_payload) {
        await ackPrintJob(
          ackPayloadWithLogin(item.ack_success_payload, loginUuid)
        );
      }

      successCount++;
    } catch (error) {
      if (!options.ack || !item.ack_failed_payload) {
        failedCount++;
        continue;
      }

      await ackPrintJob(
        ackPayloadWithLogin(
          failPayload(item.ack_failed_payload, getPrinterErrorMessage(error)),
          loginUuid
        )
      );

      failedCount++;
    }

    reportKitchenProgress(
      input,
      items.length,
      successCount,
      failedCount,
      skippedCount
    );

  }

  for (const batchGroup of groupKitchenBatchItems(batchItems)) {
    try {
      await printBatchWithLocalAgent(
        batchGroup.map((item) => item.job as PrintJob),
        undefined,
        cutMode
      );

      if (options.ack) {
        for (const item of batchGroup) {
          if (!item.ack_success_payload) continue;

          await ackPrintJob(
            ackPayloadWithLogin(item.ack_success_payload, loginUuid)
          );

          successCount++;
        }
      } else {
        successCount += batchGroup.length;
      }
    } catch (error) {
      for (const item of batchGroup) {
        if (!options.ack || !item.ack_failed_payload) {
          failedCount++;
          continue;
        }

        await ackPrintJob(
          ackPayloadWithLogin(
            failPayload(item.ack_failed_payload, getPrinterErrorMessage(error)),
            loginUuid
          )
        );

        failedCount++;
      }
    }

    reportKitchenProgress(
      input,
      items.length,
      successCount,
      failedCount,
      skippedCount
    );

  }

  input.onProgress?.({
    total: items.length,
    completed: items.length,
    successCount,
    failedCount,
    phase: "done",
  });

  return {
    successCount,
    failedCount,
    total: items.length,
  };
}

export async function executeKitchenPrintJobs(input: ExecuteKitchenPrintInput): Promise<KitchenPrintResult> {
  return executePrintJobs(input, { ack: true });
}

export async function executeInvoicePrintJobs(input: ExecuteInvoicePrintInput): Promise<KitchenPrintResult> {
  return executePrintJobs(input, { ack: false });
}
