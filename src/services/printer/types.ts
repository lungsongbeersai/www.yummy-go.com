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
  pending_job_refs?: PendingPrintJobRef[];
}
export interface PrinterCategory extends ApiEntity {
  cate_uuid: string;
  cate_name?: string;
  cate_name_la?: string;
  cate_name_eng?: string;
}
export interface PrinterZone extends ApiEntity {
  zone_uuid: string;
  zone_name?: string;
  zone_name_la?: string;
  zone_name_eng?: string;
}
// backend เพิ่งเพิ่ม mapping_type — ZONE ต้องเลือกทั้งโซนและหมวดหมู่ (บังคับคู่กัน), CATEGORY
// เลือกแค่หมวดหมู่ คนละฟิลด์กันตามชนิด: ZONE ใช้ zone_uuid_fk + cate_uuid_fk, CATEGORY ใช้แค่
// cate_uuid_fk (ไม่ใช่ฟิลด์เดียวกันใช้ซ้ำ — ทั้งสองฟิลด์แยกกันจริงบน wire)
export type PrinterMappingType = "ZONE" | "CATEGORY";
export type PrinterSharingMode = "SHARED" | "DEDICATED";
export type PrinterKitchenCutMode = "per_ticket" | "none";
export type PrinterBatchCutMode = PrinterKitchenCutMode | "end";
export type PrinterSource = "OWN" | "SHARED";
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
  // ใช้เฉพาะตอนส่งรายการอาหารเข้าครัว/บาร์ ไม่กระทบใบเรียกเก็บเงินและใบรับเงิน
  kitchen_cut_mode?: PrinterKitchenCutMode;
  // ค่าเดิมของเครื่องพิมพ์ก่อนมี option นี้คือเปิดลิ้นชักเมื่อเช็กบิล/รับเงิน
  cash_drawer_enabled?: boolean;
  is_active: boolean;
  is_active_label?: string;
  created_at?: string;
  updated_at?: string;
  font_size?: number;
  role_codes: string[];
  // เครื่องพิมพ์ที่บันทึกไว้ก่อน backend เพิ่ม mapping_type จะไม่มีฟิลด์นี้มา — ถือว่าเป็น
  // CATEGORY (พฤติกรรมเดิมก่อนมีโซน) ดู mappingTypeOf() ใน printer-form-utils.ts
  mapping_type?: PrinterMappingType;
  // เครื่องพิมพ์ที่บันทึกไว้ก่อน backend เพิ่ม sharing_mode จะไม่มีฟิลด์นี้มา — ถือว่าเป็น
  // DEDICATED (พฤติกรรมเดิมก่อนมีการแชร์เครื่องพิมพ์) ดู sharingModeOf() ใน printer-form-utils.ts
  sharing_mode?: PrinterSharingMode;
  categories?: PrinterCategory[];
  // มีความหมายทั้งสอง mapping_type: CATEGORY ใช้เป็นหมวดหมู่หลัก, ZONE ใช้เป็นหมวดหมู่ที่บังคับ
  // เลือกคู่กับโซน (ดู zone_uuid_fk ด้านล่าง)
  cate_uuid_fk: string[];
  // มีค่าเฉพาะเครื่องพิมพ์ที่ mapping_type = ZONE เท่านั้น — คนละฟิลด์กับ cate_uuid_fk
  zone_uuid_fk?: string[];
  zones?: PrinterZone[];
  // เครื่องพิมพ์ที่ผู้ใช้/อุปกรณ์ปัจจุบันเป็นเจ้าของ (ดู device_code) เทียบกับที่เห็นเพราะถูกแชร์มาจากอุปกรณ์อื่น
  // (sharing_mode = SHARED ของเจ้าของ) — ทั้ง 6 ฟิลด์นี้ backend เพิ่งเพิ่ม เครื่องพิมพ์เก่าอาจไม่มีมา
  is_owner?: boolean;
  is_shared?: boolean;
  // Shared rows from other devices are returned only while their owner agent
  // heartbeat is fresh. The current device may still receive its own offline
  // SHARED row so the settings page can manage it.
  agent_online?: boolean;
  printer_source?: PrinterSource;
  owner_device_code?: string;
  // สิทธิ์แก้ไข/ลบจริงจาก backend (เจ้าของ = true, เห็นเพราะถูกแชร์มา = false) — UI ต้องเช็คฟิลด์นี้
  // แทนการอนุมานจาก is_owner เอง เผื่อ backend มีเงื่อนไขสิทธิ์เพิ่มเติมในอนาคต
  can_edit?: boolean;
  can_delete?: boolean;
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
  kitchen_cut_mode: PrinterKitchenCutMode;
  cash_drawer_enabled?: boolean;
  role_codes: string[];
  // ไม่ส่งเลย (undefined) เมื่อผู้ใช้ไม่ได้เปิดผูกกับเมนู (ค่าเริ่มต้น "OFF" ในฟอร์ม) — ต่างจาก
  // CATEGORY ที่เป็นการเลือกจริง savePrinter() ใน config-api.ts ต้องคง key นี้หายไปทั้งหมดบน wire
  mapping_type?: PrinterMappingType;
  sharing_mode: PrinterSharingMode;
  // backend บังคับ: mapping_type = ZONE ต้องส่งทั้ง zone_uuid_fk และ cate_uuid_fk (เลือกหมวดหมู่
  // ด้วยเสมอ); mapping_type = CATEGORY ส่งแค่ cate_uuid_fk; ไม่มี mapping_type เลยไม่ส่งทั้งคู่ —
  // savePrinter() ใน config-api.ts เป็นจุดเดียวที่ตัดฟิลด์เหล่านี้ตาม mapping_type
  zone_uuid_fk?: string[];
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
  cut_mode?: PrinterBatchCutMode;
  open_cash_drawer?: boolean;
  print_job_item_uuid?: string;
  requested_by?: string;
  interface_value: string;
  printer_type: string;
  ops: Record<string, unknown>[];
  meta?: ApiEntity | null;
}
export type PrinterDeliveryState = "printed" | "not_sent" | "unknown";
export interface PrintOpsAgentResponse extends ApiEntity {
  ok: boolean;
  error?: string;
  message?: string;
}
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
  // Backend groups physical print jobs by printer. Keep the queue-item IDs on
  // the group so the client can ACK successful and failed printers separately.
  print_job_item_uuids?: string[];
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
  print_config_uuid?: string | null;
  delivery_state?: PrinterDeliveryState;
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
export interface PendingPrintJobRef extends ApiEntity {
  print_job_uuid: string;
  source?: string | null;
  device_code?: string | null;
  agent_id?: string | null;
  print_mode?: string | null;
  remote_shared_print?: boolean;
}
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
  pendingJobRefs?: PendingPrintJobRef[];
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
export interface KitchenPrintResult {
  successCount: number;
  failedCount: number;
  total: number;
  errorMessage?: string;
  pending?: boolean;
}
export interface DefaultCategoryByRoleInput extends ApiEntity {
  login_uuid_fk: string;
  role_codes: string[];
  mapping_type: PrinterMappingType;
  print_config_uuid_fk?: string;
  lang?: string;
}
// รายละเอียดต่อกลุ่มมีฟิลด์คนละชุดตาม mapping_type: ZONE ใช้ zone_uuid/zone_name,
// CATEGORY ใช้ cate_uuid/cate_name — ไม่ใช่ทั้งสองอย่างพร้อมกันในรายการเดียว
export interface DefaultCategoryZoneDetail extends ApiEntity {
  zone_uuid: string;
  zone_name?: string;
  is_default: boolean;
}
export interface DefaultCategoryCategoryDetail extends ApiEntity {
  cate_uuid: string;
  cate_name?: string;
  is_default: boolean;
}
export type DefaultCategoryGroupDetail = DefaultCategoryZoneDetail | DefaultCategoryCategoryDetail;
export interface DefaultCategoryGroup extends ApiEntity {
  status_sort: number;
  status_name: PrinterMappingType;
  mapping_type: PrinterMappingType;
  details: DefaultCategoryGroupDetail[];
}
export interface DefaultCategoryByRoleData extends ApiEntity {
  lang?: string;
  role_codes: string[];
  print_config_uuid_fk?: string | null;
  selected_from_saved_config: boolean;
  mapping_type: PrinterMappingType;
  groups: DefaultCategoryGroup[];
}
export type DefaultCategoryByRoleResponse = ApiDataResponse<DefaultCategoryByRoleData>;
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
export type ExecuteReportPrintInput = ExecuteKitchenPrintInput;

export type CheckPrinterAgentConnectionResult =
  | { ok: true; agent: AgentInfo }
  | { ok: false; error: string };
