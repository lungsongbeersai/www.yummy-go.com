import { ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { EmployeeWorkParams, EmployeeWorkResponse } from "@/services/pos";
import type { AuthUser } from "@/stores/auth-store";
import { employeeWorkPeriod } from "@/features/pos/employee-work/employee-work-period";

export function employeeWorkIdentity(user: AuthUser | null, token: string | null) {
  return JSON.stringify([user?.uuid, user?.store_uuid || user?.store_uuid_fk || "", user?.branch_uuid, user?.status, user?.store_status, token]);
}

export function employeeWorkQueryKey(params: EmployeeWorkParams) {
  return JSON.stringify([params.scope ?? "current", params.search?.trim() ?? "", params.kitchen_status ?? "all", params.payment_status ?? "all", toApiLanguage(params.lang), params.page ?? 1, params.limit ?? 20]);
}

export function requireEmployeeWorkItems(response: EmployeeWorkResponse, employeeUuid: string) {
  if (!employeeUuid || response.ownership_mode !== "item_creator" || response.totals_basis !== "item_net_before_bill_adjustments") throw new ServiceError("The work report has an unsupported ownership policy", 403);
  const seen = new Set<string>();
  for (const order of response.data) {
    if (!order.items.length || order.scope !== response.filters.scope || (order.scope !== "current" && (order.is_cancelled || !["open", "unknown"].includes(order.bill_state)))) throw new ServiceError("The work items do not belong to the selected scope", 403);
    for (const item of order.items) {
      if (item.created_by !== employeeUuid || !item.order_it_uuid?.trim() || seen.has(item.order_it_uuid)) throw new ServiceError("The work report contains items belonging to another employee or duplicate items", 403);
      seen.add(item.order_it_uuid);
      if (order.scope !== "current" && ![0, 1, 2, 3, 4].includes(item.status)) throw new ServiceError("The work report contains items that are no longer actionable", 403);
      const knownTime = item.created_at_source === "item_audit" || item.created_at_source === "stored_item_time";
      if (knownTime) {
        if (!item.created_at || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(item.created_at) || !Number.isFinite(Date.parse(item.created_at)) || employeeWorkPeriod(new Date(item.created_at)).businessDay !== item.business_date) throw new ServiceError("The work item's business date could not be verified", 409);
      } else if (item.created_at_source !== "unknown" || item.created_at !== null || item.business_date !== null) throw new ServiceError("The work item's time provenance could not be verified", 409);
      const validScope = order.scope === "current" ? item.business_date === response.business_day.date
        : order.scope === "carryover" ? item.business_date !== null && item.business_date < response.business_day.date
          : item.business_date === null;
      if (!validScope) throw new ServiceError("The work item's business date does not match the selected scope", 409);
    }
  }
}

export function requireEmployeeWorkScope(response: EmployeeWorkResponse, user: AuthUser | null, params: EmployeeWorkParams, report = false) {
  if (!user || response.employee.login_uuid !== user.uuid || response.employee.branch_uuid !== user.branch_uuid || response.employee.store_uuid !== (user.store_uuid || user.store_uuid_fk)) {
    throw new ServiceError("The work report belongs to another employee or branch", 403);
  }
  requireEmployeeWorkItems(response, user.uuid);
  if (response.filters.scope !== (params.scope ?? "current") || response.filters.search !== (params.search?.trim() ?? "") || response.filters.kitchen_status !== (params.kitchen_status ?? "all") || response.filters.payment_status !== (params.payment_status ?? "all") || response.filters.lang !== toApiLanguage(params.lang)) {
    throw new ServiceError("The work report does not match the selected filters", 409);
  }
  if (response.business_day.time_zone !== "Asia/Vientiane" || response.business_day.cutoff !== "05:00" || response.filters.business_date !== response.business_day.date) throw new ServiceError("The work period could not be verified", 409);
  if (report && (!response.report.complete || response.data.length !== response.pagination.total)) throw new ServiceError("The complete work report could not be loaded", 409);
}
