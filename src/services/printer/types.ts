// Types/interfaces for the printer service (P3.4 split of printer.ts).
// Shared by config-api.ts, agent-transport.ts and print-jobs.ts — kept
// dependency-free of them so it sits at the bottom of the import graph.
import type { ApiDataResponse, ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";
import type { ConfirmToKitchenPendingQuery, ConfirmToKitchenPrintJob } from "@/services/pos";

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
export interface AgentInfoResponse extends ApiEntity {
  ok?: boolean;
  data?: AgentInfo;
  agent?: AgentInfo;
  error?: string;
  message?: string;
}

export interface PendingPrintJobsFullResponse extends ApiEntity {
  data?: PendingPrintJobData[];
  print_batch_payloads?: PrintOpsBatchPayload[];
  print_summary?: ApiEntity;
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
export interface SearchPrintersResponse extends ApiEntity {
  ok?: boolean;
  mode?: "usb" | "network";
  agent?: AgentInfo;
  data?: SearchPrinterResult[];
  error?: string;
  message?: string;
}
export interface FetchPrinterPayload extends ApiEntity {
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
export interface MobileEscposRenderResponse extends ApiEntity {
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
export interface PendingPrintJobsResult {
  jobs: PendingPrintJobData[];
  batchPayloads: PrintOpsBatchPayload[];
  hasBatchPayloads: boolean;
  ackSuccess: AckPayload | null;
  ackFailed: AckPayload | null;
  printSummary: ApiEntity;
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
export interface KitchenPrintResult { successCount: number; failedCount: number; total: number; errorMessage?: string }
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

export type CheckPrinterAgentConnectionResult =
  | { ok: true; agent: AgentInfo }
  | { ok: false; error: string };
