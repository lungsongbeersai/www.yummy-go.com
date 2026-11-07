import { internalRoute } from "@/lib/routes";
import type { WaiterRequest } from "@/services/waiter-requests";

export function billRequestOrderUrl(request: WaiterRequest, language: string, openKey: string) {
  const tableUuid = request.table_uuid.trim();
  const requestUuid = request.request_uuid.trim();
  if (request.request_type !== "bill" || request.status === 2 || !tableUuid || !requestUuid) return null;
  const tableName = language === "en"
    ? request.table_name_eng || request.table_name_la
    : request.table_name_la || request.table_name_eng;
  const params = new URLSearchParams({ table_uuid: tableUuid });
  if (tableName) params.set("table_name", tableName);
  // A fresh intent also reopens the cart when this table is already on screen.
  params.set("bill_request", `${requestUuid}:${openKey}`);
  return internalRoute(`/posAll/order?${params.toString()}`);
}
