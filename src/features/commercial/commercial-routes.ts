import type { CommercialDocumentType } from "@/services/commercial";

export type CommercialTab = "catalog" | "quotations" | "receipts";
export interface CommercialRouteScope { storeUuid?: string; branchUuid?: string }

function scopeParams(scope: CommercialRouteScope) {
  const params = new URLSearchParams();
  if (scope.storeUuid) params.set("store_uuid", scope.storeUuid);
  if (scope.branchUuid) params.set("branch_uuid", scope.branchUuid);
  return params;
}

export function commercialDocumentType(value: string | null): CommercialDocumentType {
  return value === "receipt" ? "receipt" : "quotation";
}

export function commercialTab(value: string | null): CommercialTab {
  return value === "quotations" || value === "receipts" ? value : "catalog";
}

export function commercialHistoryHref(scope: CommercialRouteScope, tab: CommercialTab = "catalog", documentUuid?: string) {
  const params = scopeParams(scope);
  params.set("tab", tab);
  if (documentUuid) params.set("document_uuid", documentUuid);
  return `/commercial?${params.toString()}`;
}

export function commercialCreateHref(scope: CommercialRouteScope, type: CommercialDocumentType) {
  const params = scopeParams(scope);
  params.set("type", type);
  return `/commercial/new?${params.toString()}`;
}

export function commercialEditHref(scope: CommercialRouteScope, documentUuid: string) {
  return `/commercial/${encodeURIComponent(documentUuid)}/edit?${scopeParams(scope).toString()}`;
}

export function commercialRequestedScopeMatches(requested: CommercialRouteScope, verified: CommercialRouteScope) {
  return (!requested.storeUuid || requested.storeUuid === verified.storeUuid) && (!requested.branchUuid || requested.branchUuid === verified.branchUuid);
}
