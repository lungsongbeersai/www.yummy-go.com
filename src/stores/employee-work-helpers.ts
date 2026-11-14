import { ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { EmployeeWorkParams, EmployeeWorkResponse } from "@/services/pos";
import type { AuthUser } from "@/stores/auth-store";

export function employeeWorkIdentity(user: AuthUser | null, token: string | null) {
  return JSON.stringify([user?.uuid, user?.store_uuid || user?.store_uuid_fk || "", user?.branch_uuid, user?.status, user?.store_status, token]);
}

export function employeeWorkQueryKey(params: EmployeeWorkParams) {
  return JSON.stringify([params.scope ?? "current", params.search?.trim() ?? "", params.kitchen_status ?? "all", params.payment_status ?? "all", toApiLanguage(params.lang), params.page ?? 1, params.limit ?? 20]);
}

export function requireEmployeeWorkScope(response: EmployeeWorkResponse, user: AuthUser | null, params: EmployeeWorkParams, report = false) {
  if (!user || response.ownership_mode !== "bill_opener" || response.employee.login_uuid !== user.uuid || response.employee.branch_uuid !== user.branch_uuid || response.employee.store_uuid !== (user.store_uuid || user.store_uuid_fk) || response.data.some(order => order.order_created_by !== user.uuid || order.scope !== response.filters.scope)) {
    throw new ServiceError("The work report belongs to another employee or branch", 403);
  }
  if (response.filters.scope !== (params.scope ?? "current") || response.filters.search !== (params.search?.trim() ?? "") || response.filters.kitchen_status !== (params.kitchen_status ?? "all") || response.filters.payment_status !== (params.payment_status ?? "all") || response.filters.lang !== toApiLanguage(params.lang)) {
    throw new ServiceError("The work report does not match the selected filters", 409);
  }
  if (response.business_day.time_zone !== "Asia/Vientiane" || response.business_day.cutoff !== "05:00" || response.filters.business_date !== response.business_day.date) throw new ServiceError("The work period could not be verified", 409);
  if (report && (!response.report.complete || response.data.length !== response.pagination.total)) throw new ServiceError("The complete work report could not be loaded", 409);
}
