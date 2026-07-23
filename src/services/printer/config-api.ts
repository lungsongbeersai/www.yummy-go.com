// Printer config CRUD + backend API calls (P3.4 split of printer.ts).
// Kept dependency-free of agent-transport.ts / print-jobs.ts so it sits low in
// the import graph — agent-transport.ts depends on this module (getPrinters,
// sendMobileBackendPrintJob), not the other way around.
import axios from "axios";
import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { AGENT_URL } from "@/config/printer-agent";
import {
  AGENT_SECRET,
  agentBase as printerAgentBase,
  assertAgentOk,
  mapPrinter,
  tcpInterfaceValue,
  textValue
} from "@/services/printer/helpers";
import type {
  AgentFilesResponse,
  BuildTestJobRequest,
  BuildTestJobResponse,
  CategoryRole,
  DefaultCategoryByRoleInput,
  DefaultCategoryByRoleResponse,
  FetchPrinterResponse,
  FetchPrintersParams,
  MobileEscposRenderResponse,
  PrintJob,
  Printer,
  PrinterCategoryRole,
  PrinterRolesResponse,
  ResolvedPrinter,
  SaveCategoryPrinterInput,
  SaveCategoryRoleInput,
  SavePrinterInput,
  SavePrinterResponse,
  SearchPrintersResponse
} from "@/services/printer/types";
import type { ApiDataResponse } from "@/services/shared/types";

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
