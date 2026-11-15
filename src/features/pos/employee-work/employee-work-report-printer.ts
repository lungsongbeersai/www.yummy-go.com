import { ServiceError } from "@/lib/api";
import type { EmployeeWorkResponse } from "@/services/pos";
import type { AgentInfo, ExecuteReportPrintInput, KitchenPrintResult, PrintProgress } from "@/services/printer";
import type { ReportPrintInput, ReportPrintOp, ReportPrintResponse } from "@/services/report";
import { requireEmployeeWorkItems } from "@/stores/employee-work-helpers";
import { formatReportDateTime } from "@/features/report/shared/report-date-format";
import { employeeWorkBillLabel, employeeWorkKitchenLabel, employeeWorkPaymentLabels, employeeWorkPrintLabel, employeeWorkQuantity, employeeWorkScopeLabel } from "./employee-work-format";
import type { EmployeeWorkLabel } from "./employee-work-print";

export type EmployeeWorkPrintErrorCode = "stale" | "invalid-report" | "report-too-large" | "report-printer-unavailable" | "print-failed" | "delivery-unknown";

export class EmployeeWorkPrintError extends Error {
  constructor(public readonly code: EmployeeWorkPrintErrorCode, public readonly mayHavePrinted = false) {
    // UI owns localized messages; never expose native exceptions or job payloads.
    super(code);
    this.name = "EmployeeWorkPrintError";
  }
}

export interface EmployeeWorkPrintTransport {
  resolveDeviceIdentity(): Promise<Pick<AgentInfo, "device_code">>;
  submitReportPrint(input: ReportPrintInput): Promise<ReportPrintResponse>;
  executeReport(input: ExecuteReportPrintInput): Promise<KitchenPrintResult>;
}

export interface EmployeeWorkEscposPrintInput {
  report: EmployeeWorkResponse;
  jobName: string;
  label: EmployeeWorkLabel;
  language: string;
  isCurrent: () => boolean;
  transport: EmployeeWorkPrintTransport;
  onProgress?: (progress: PrintProgress) => void;
}

export interface EmployeeWorkPrintOutcome { status: "printed" }

const MAX_REPORT_BYTES = 2 * 1024 * 1024;
const MAX_REPORT_ITEMS = 20_000;
// Existing backend sanitizer otherwise slices ops/text silently. Reject the
// complete receipt before queueing rather than print an incomplete own report.
const REPORT_OP_LIMITS = { operations: 2000, text: 5000, column: 2500, totalText: 250000 } as const;
const activePrints = new WeakMap<EmployeeWorkResponse, Promise<EmployeeWorkPrintOutcome>>();

function completeReport(report: EmployeeWorkResponse) {
  if (!report.report.complete || report.data.length !== report.pagination.total) throw new EmployeeWorkPrintError("invalid-report");
  if (report.data.length > Math.min(1000, report.report.max_orders) || report.data.reduce((sum, order) => sum + order.items.length, 0) > MAX_REPORT_ITEMS) throw new EmployeeWorkPrintError("report-too-large");
  try { requireEmployeeWorkItems(report, report.employee.login_uuid); }
  catch { throw new EmployeeWorkPrintError("invalid-report"); }
}

function clean(value: unknown) {
  // Text is rendered by the existing receipt renderer, never printer commands.
  return Array.from(String(value ?? "")).map(character => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? " " : character;
  }).join("");
}

/** Full owned details in the existing report-printer protocol, without A4 HTML. */
export function buildEmployeeWorkReportOps(report: EmployeeWorkResponse, label: EmployeeWorkLabel): ReportPrintOp[] {
  completeReport(report);
  const ops: ReportPrintOp[] = [];
  let totalText = 0;
  const append = (op: ReportPrintOp) => {
    if (ops.length >= REPORT_OP_LIMITS.operations) throw new EmployeeWorkPrintError("report-too-large");
    ops.push(op);
  };
  const boundedText = (value: unknown, maximum: number) => {
    const result = clean(value);
    totalText += result.length;
    if (result.length > maximum || totalText > REPORT_OP_LIMITS.totalText) throw new EmployeeWorkPrintError("report-too-large");
    return result;
  };
  const text = (value: unknown, bold = false, size = 24, align: "left" | "center" | "right" = "left") => {
    append({ type: "text", text: boundedText(value, REPORT_OP_LIMITS.text), align, bold, size, text_role: bold ? "report_heading" : "report_detail" });
  };
  const lr = (left: unknown, right: unknown) => { append({ type: "lr", left: boundedText(left, REPORT_OP_LIMITS.column), right: boundedText(right, REPORT_OP_LIMITS.column), size: 24 }); };
  const line = () => { append({ type: "line" }); };
  const amount = (value: number | null) => value === null ? label("unknown") : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  const quantity = (value: number | null) => value === null ? label("unknown") : employeeWorkQuantity(value);
  const payment = (value: EmployeeWorkResponse["filters"]["payment_status"]) => value === "all" ? label("all") : employeeWorkPaymentLabels(value).map(label).join(" · ");
  const financialWarning = (value: string) => label(value === "SET_OWNERSHIP_AMBIGUOUS" ? "setOwnershipReview" : "billNeedsReview");
  const summary = () => {
    lr(label("bills"), report.summary.order_count);
    lr(label("ownItems"), report.summary.item_count);
    lr(label("quantity"), quantity(report.summary.quantity));
    lr(label("unclosedBills"), report.summary.open_count);
    text(label("ownTotal"), true, 28);
    text(`${amount(report.summary.total_amount)} LAK`, true, 34, "right");
  };
  text(label("reportTitle"), true, 34, "center");
  if (report.employee.branch_name) text(report.employee.branch_name, false, 26, "center");
  text(`${label("responsibleEmployee")}: ${report.employee.display_name}`, true);
  text(`${label("period")}: ${formatReportDateTime(report.business_day.starts_at)} – ${formatReportDateTime(new Date(Date.parse(report.business_day.ends_at) - 1).toISOString())}`);
  text(`${label(employeeWorkScopeLabel(report.filters.scope))} · Asia/Vientiane`);
  if (report.filters.search) text(report.filters.search);
  text(`${label("kitchen")}: ${label(report.filters.kitchen_status === "all" ? "all" : employeeWorkKitchenLabel(report.filters.kitchen_status))}`);
  text(`${label("settlement")}: ${payment(report.filters.payment_status)}`);
  text(`${label("refreshedAt")}: ${formatReportDateTime(report.server_now)}`);
  text(label("amountsHint"));
  text(label("currentState"));
  if (report.summary.financial_unknown_count) text(label("unknownAmounts"));
  line(); summary();
  for (const order of report.data) {
    line();
    text(`${order.table_name || label("noTable")}${order.zone_name ? ` · ${order.zone_name}` : ""}`, true, 28);
    text(order.order_invoice || order.order_uuid, true);
    text(`${label("billOpenedBy")}: ${order.creator_name || label("unknownEmployee")}`);
    text(`${label("sharedBillStatus")}: ${label(employeeWorkBillLabel(order.bill_state))}${order.check_bill_requested ? ` · ${label("checkBillRequested")}` : ""}`);
    text(`${label("kitchen")}: ${label(employeeWorkKitchenLabel(order.kitchen_status))} · ${label("settlement")}: ${payment(order.payment_status)}`);
    if (order.time_warning) text(label(order.time_warning === "ITEM_TIME_IS_RECORD_TIME" ? "recordedItemTime" : "unknownItemTime"));
    if (order.financial_warning) text(financialWarning(order.financial_warning));
    for (const item of order.items) {
      text(`${item.product_name}${item.size_name ? ` · ${item.size_name}` : ""}`, true, 26);
      if (item.is_set_component) text(label("setComponent"));
      lr(`${label("unitPrice")}: ${amount(item.price)} LAK`, `${label("quantity")}: ${quantity(item.quantity)}`);
      for (const topping of item.toppings) text(`${topping.topping_name} × ${quantity(topping.quantity)} · ${amount(topping.price)} LAK`);
      if (item.note) text(item.note);
      if (item.item_discount_amount === null || item.item_discount_amount > 0) lr(label("itemDiscount"), amount(item.item_discount_amount));
      lr(label("lineTotal"), `${amount(item.total)} LAK`);
      text(`${label("contributedBy")}: ${item.created_by_name || label("unknownEmployee")}`);
      text(item.created_at ? formatReportDateTime(item.created_at) : label("unknownItemTime"));
      text(label(item.status === 9 ? "cancelledItem" : item.kitchen_sent ? "sent" : "pending"));
      if (item.print_status !== "unknown") text(`${label("printStatus")}: ${label(employeeWorkPrintLabel(item.print_status))}`);
      if (item.financial_warning) text(financialWarning(item.financial_warning));
    }
    lr(label("ownItems"), order.own_totals.item_count);
    lr(label("quantity"), quantity(order.own_totals.quantity));
    lr(label("ownTotal"), `${amount(order.own_totals.total_amount)} LAK`);
  }
  if (!report.data.length) text(label("empty"));
  line();
  text(label("amountsHint"));
  append({ type: "blank", n: 2 });
  if (new TextEncoder().encode(JSON.stringify(ops)).length > MAX_REPORT_BYTES) throw new EmployeeWorkPrintError("report-too-large");
  return ops;
}

function assertCurrent(input: EmployeeWorkEscposPrintInput) {
  if (!input.isCurrent()) throw new EmployeeWorkPrintError("stale");
}

async function performPrint(input: EmployeeWorkEscposPrintInput): Promise<EmployeeWorkPrintOutcome> {
  assertCurrent(input);
  completeReport(input.report);
  const ops = buildEmployeeWorkReportOps(input.report, input.label);
  assertCurrent(input);
  let identity: Pick<AgentInfo, "device_code">;
  try { identity = await input.transport.resolveDeviceIdentity(); }
  catch { assertCurrent(input); throw new EmployeeWorkPrintError("print-failed"); }
  assertCurrent(input);
  if (!identity.device_code?.trim()) throw new EmployeeWorkPrintError("report-printer-unavailable");
  let queued: ReportPrintResponse;
  try {
    queued = await input.transport.submitReportPrint({
      device_code: identity.device_code, report_key: "employee_work", report_title: input.jobName,
      lang: input.language,
      print_document: { paper_width_mm: 80, copies: 1, cut_mode: "per_ticket", ops },
    });
  } catch (error) {
    assertCurrent(input);
    if (error instanceof ServiceError && error.statusCode === 413) throw new EmployeeWorkPrintError("report-too-large");
    if (error instanceof ServiceError && [400,401,403,404,422].includes(error.statusCode)) throw new EmployeeWorkPrintError("print-failed");
    // The queue may have committed before the response was lost. Do not submit
    // another job or fall back to another transport automatically.
    throw new EmployeeWorkPrintError("delivery-unknown", true);
  }
  assertCurrent(input);
  const pending = queued.pending_query;
  if (!pending) throw new EmployeeWorkPrintError("report-printer-unavailable");
  // A branch SHARED report printer legitimately belongs to another terminal.
  // Preserve the server target/relay metadata; only the requesting actor is fixed.
  if (!pending.print_job_uuid?.trim() || pending.login_uuid_fk !== input.report.employee.login_uuid) throw new EmployeeWorkPrintError("delivery-unknown", true);
  assertCurrent(input);
  let result: KitchenPrintResult;
  try {
    result = await input.transport.executeReport({
      pending_query: pending, login_uuid_fk: input.report.employee.login_uuid, device_code: identity.device_code,
      onProgress: progress => { input.onProgress?.(progress); },
    });
  } catch { assertCurrent(input); throw new EmployeeWorkPrintError("delivery-unknown", true); }
  assertCurrent(input);
  if (result.pending || ![result.total,result.successCount,result.failedCount].every(Number.isSafeInteger) ||
    result.failedCount !== 0 || result.total <= 0 || result.successCount !== result.total) throw new EmployeeWorkPrintError("delivery-unknown", true);
  return { status: "printed" };
}

/** Explicit ESC/POS on every platform; never selects a PDF/system-print fallback. */
export function printEmployeeWorkEscpos(input: EmployeeWorkEscposPrintInput): Promise<EmployeeWorkPrintOutcome> {
  if (!input.isCurrent()) return Promise.reject(new EmployeeWorkPrintError("stale"));
  const existing = activePrints.get(input.report);
  if (existing) return existing;
  const operation = performPrint(input);
  activePrints.set(input.report, operation);
  const cleanup = () => { if (activePrints.get(input.report) === operation) activePrints.delete(input.report); };
  void operation.then(cleanup, cleanup);
  return operation;
}
