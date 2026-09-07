"use client";

import { getOrderAuditReport, type OrderAuditParams, type OrderAuditResponse } from "@/services/report";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createSimpleReportStore } from "./create-report-store";

export const useOrderAuditReportStore = createSimpleReportStore<
  OrderAuditParams, OrderAuditResponse, { report: OrderAuditResponse | null }
>({
  key: "orderAudit",
  fetch: getOrderAuditReport,
  finalize: (report) => ({ report }),
  emptyState: { report: null },
  clearOnStart: true,
});

registerSessionStoreReset("order-audit-report", () => useOrderAuditReportStore.getState().reset());
