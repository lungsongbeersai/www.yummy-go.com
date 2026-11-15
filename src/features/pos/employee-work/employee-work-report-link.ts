import type { EmployeeWorkKitchenStatus, EmployeeWorkPaymentStatus, EmployeeWorkScope } from "@/services/pos";
import { LAO_FONTS, type LaoFont } from "@/stores/app-store";
import type { Language } from "@/lib/language";
import { EMPLOYEE_WORK_KITCHEN, EMPLOYEE_WORK_PAYMENT, EMPLOYEE_WORK_SCOPES } from "./employee-work-format";

export interface EmployeeWorkReportDestination {
  employeeUuid: string;
  branchUuid: string;
  businessDate: string;
  scope: EmployeeWorkScope;
  kitchenStatus: "all" | EmployeeWorkKitchenStatus;
  paymentStatus: "all" | EmployeeWorkPaymentStatus;
  search: string;
  language: Language;
  laoFont: LaoFont;
}

export const EMPLOYEE_WORK_REPORT_PATH = "/my_work/report";
const keys = new Set(["employee", "branch", "date", "scope", "kitchen", "payment", "search", "lang", "font"]);
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Expected IDs are consistency checks; the API always selects its actor from JWT. */
export function parseEmployeeWorkReportDestination(params: URLSearchParams): EmployeeWorkReportDestination | null {
  if (Array.from(params.keys()).some(key => !keys.has(key) || params.getAll(key).length !== 1)) return null;
  const employeeUuid = params.get("employee") ?? "", branchUuid = params.get("branch") ?? "", businessDate = params.get("date") ?? "";
  const scope = EMPLOYEE_WORK_SCOPES.find(value => value === params.get("scope"));
  const kitchenStatus = EMPLOYEE_WORK_KITCHEN.find(value => value === params.get("kitchen"));
  const paymentStatus = EMPLOYEE_WORK_PAYMENT.find(value => value === params.get("payment"));
  const laoFont = LAO_FONTS.find(value => value === params.get("font"));
  const language = params.get("lang"), search = params.get("search") ?? "";
  if (!uuid.test(employeeUuid) || !uuid.test(branchUuid) || !validDate(businessDate) || !scope || !kitchenStatus || !paymentStatus || !laoFont ||
    (language !== "la" && language !== "en") || search.length > 120 || /[\p{Cc}\p{Cf}]/u.test(search)) return null;
  return { employeeUuid, branchUuid, businessDate, scope, kitchenStatus, paymentStatus, search, language, laoFont };
}

export function employeeWorkReportHref(destination: EmployeeWorkReportDestination): string {
  const params = new URLSearchParams({
    employee: destination.employeeUuid, branch: destination.branchUuid, date: destination.businessDate,
    scope: destination.scope, kitchen: destination.kitchenStatus, payment: destination.paymentStatus,
    search: destination.search, lang: destination.language, font: destination.laoFont,
  });
  if (!parseEmployeeWorkReportDestination(params)) throw new Error("Invalid employee report destination");
  return `${EMPLOYEE_WORK_REPORT_PATH}?${params}`;
}

export function employeeWorkBrowserPdfUrl(origin: string, destination: EmployeeWorkReportDestination): string {
  const base = new URL(origin);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.username || base.password || (base.protocol !== "https:" && !(base.protocol === "http:" && loopback))) throw new Error("Invalid employee report origin");
  // The installed Android shell can open HTTPS with AppLauncher. No credentials,
  // report contents or private PDF bytes are handed to another application.
  const url = new URL("/login", base.origin);
  url.searchParams.set("redirect", employeeWorkReportHref(destination));
  return url.href;
}
