"use client";

import { getCustomerSalesReport, type CustomerSalesParams, type CustomerSalesResponse } from "@/services/report";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createSimpleReportStore } from "./create-report-store";

export const useCustomerSalesReportStore = createSimpleReportStore<
  CustomerSalesParams, CustomerSalesResponse, { report: CustomerSalesResponse | null }
>({
  key: "customerSalesReport",
  fetch: getCustomerSalesReport,
  finalize: (report) => ({ report }),
  emptyState: { report: null },
  clearOnStart: true,
});

registerSessionStoreReset("customer-sales-report", () => useCustomerSalesReportStore.getState().reset());
